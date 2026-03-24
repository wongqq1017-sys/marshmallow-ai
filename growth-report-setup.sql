-- 成長報告數據庫設置
-- 添加 growth_reports 表來存儲用戶的成長報告

-- 確保 UUID 擴展已啟用
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 創建 growth_reports 表
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'growth_reports') THEN
        CREATE TABLE public.growth_reports (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            report_type TEXT NOT NULL DEFAULT 'monthly', -- 'weekly', 'monthly', 'quarterly'
            report_date DATE NOT NULL DEFAULT CURRENT_DATE,
            
            -- 情緒數據
            mood_data JSONB NOT NULL DEFAULT '[]',
            
            -- 核心成長領域分數 (0-100)
            growth_scores JSONB NOT NULL DEFAULT '{
                "social": 50,
                "confidence": 50,
                "work": 50,
                "health": 50,
                "courage": 50
            }',
            
            -- 達成成就
            achievements JSONB NOT NULL DEFAULT '[]',
            
            -- 棉花糖的話
            marshmallow_message TEXT,
            
            -- 報告摘要
            summary JSONB NOT NULL DEFAULT '{
                "total_diary_entries": 0,
                "total_chat_messages": 0,
                "average_mood": 0,
                "streak_days": 0,
                "top_category": ""
            }',
            
            -- 報告狀態
            is_generated BOOLEAN NOT NULL DEFAULT false,
            
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    END IF;
END $$;

-- 啟用 RLS
ALTER TABLE public.growth_reports ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 策略
DROP POLICY IF EXISTS "Users can view own growth reports" ON public.growth_reports;
CREATE POLICY "Users can view own growth reports" ON public.growth_reports FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own growth reports" ON public.growth_reports;
CREATE POLICY "Users can insert own growth reports" ON public.growth_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own growth reports" ON public.growth_reports;
CREATE POLICY "Users can update own growth reports" ON public.growth_reports FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own growth reports" ON public.growth_reports;
CREATE POLICY "Users can delete own growth reports" ON public.growth_reports FOR DELETE USING (auth.uid() = user_id);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_growth_reports_user_id ON public.growth_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_reports_report_date ON public.growth_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_growth_reports_report_type ON public.growth_reports(report_type);

-- 創建自動生成報告的函數
CREATE OR REPLACE FUNCTION public.generate_growth_report(
    p_user_id UUID,
    p_report_type TEXT DEFAULT 'monthly'
)
RETURNS UUID AS $$
DECLARE
    v_report_id UUID;
    v_start_date DATE;
    v_end_date DATE;
    v_diary_entries JSONB;
    v_mood_values JSONB;
    v_summary JSONB;
    v_marshmallow_message TEXT;
    v_growth_scores JSONB;
    v_achievements JSONB;
BEGIN
    -- 根據報告類型計算日期範圍
    CASE p_report_type
        WHEN 'weekly' THEN
            v_end_date := CURRENT_DATE;
            v_start_date := CURRENT_DATE - INTERVAL '7 days';
        WHEN 'monthly' THEN
            v_end_date := CURRENT_DATE;
            v_start_date := CURRENT_DATE - INTERVAL '30 days';
        WHEN 'quarterly' THEN
            v_end_date := CURRENT_DATE;
            v_start_date := CURRENT_DATE - INTERVAL '90 days';
        ELSE
            v_end_date := CURRENT_DATE;
            v_start_date := CURRENT_DATE - INTERVAL '30 days';
    END CASE;

    -- 獲取日期範圍內的日記
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', id,
            'date', date,
            'title', title,
            'content', content,
            'emoji', emoji,
            'tags', tags
        ) ORDER BY date
    ), '[]'::jsonb)
    INTO v_diary_entries
    FROM public.diary_entries
    WHERE user_id = p_user_id
      AND date >= v_start_date
      AND date <= v_end_date;

    -- 計算情緒值（從日記的emoji轉換）
    SELECT COALESCE(
        jsonb_agg(
            CASE 
                WHEN emoji = '😊' OR emoji = '😄' OR emoji = '✨' THEN 80
                WHEN emoji = '🙂' OR emoji = '💪' OR emoji = '🌸' THEN 65
                WHEN emoji = '😐' OR emoji = '😌' THEN 50
                WHEN emoji = '😔' OR emoji = '😢' THEN 35
                WHEN emoji = '😢' OR emoji = '💔' THEN 20
                ELSE 50
            END
        ) FILTER (WHERE emoji IS NOT NULL),
        '[]'::jsonb
    )
    INTO v_mood_values
    FROM public.diary_entries
    WHERE user_id = p_user_id
      AND date >= v_start_date
      AND date <= v_end_date;

    -- 計算摘要
    SELECT jsonb_build_object(
        'total_diary_entries', COALESCE(jsonb_array_length(v_diary_entries), 0),
        'total_chat_messages', 0,
        'average_mood', CASE 
            WHEN jsonb_array_length(v_mood_values) > 0 
            THEN (SELECT AVG(val) FROM jsonb_array_elements_text(v_mood_values) AS val)
            ELSE 50 
        END,
        'streak_days', (
            SELECT COUNT(DISTINCT date) 
            FROM public.diary_entries 
            WHERE user_id = p_user_id 
              AND date >= v_start_date 
              AND date <= v_end_date
        ),
        'top_category', (
            SELECT COALESCE(
                (SELECT tag FROM unnest(COALESCE(array_agg(tags), '{}')) AS tag 
                 WHERE tag NOT IN ('🌸', '✨', '💪', '❤️') 
                 GROUP BY tag 
                 ORDER BY COUNT(*) DESC LIMIT 1),
                'general'
            )
            FROM public.diary_entries
            WHERE user_id = p_user_id
              AND date >= v_start_date
              AND date <= v_end_date
        )
    )
    INTO v_summary;

    -- 根據日記內容評估成長分數（簡單版本）
    -- 實際上應該由 AI 分析，這裡提供基礎分數
    v_growth_scores := jsonb_build_object(
        'social', 50,
        'confidence', 50,
        'work', 50,
        'health', 50,
        'courage', 50
    );

    -- 根據記錄天數解鎖成就
    v_achievements := '[]'::jsonb;
    IF (v_summary->>'streak_days')::int >= 7 THEN
        v_achievements := v_achievements || '[{"id": "week_streak", "name": "一週持續", "icon": "local_fire_department"}]'::jsonb;
    END IF;
    IF (v_summary->>'total_diary_entries')::int >= 21 THEN
        v_achievements := v_achievements || '[{"id": "monthly_complete", "name": "月度圓滿", "icon": "stars"}]'::jsonb;
    END IF;
    IF (v_summary->>'total_diary_entries')::int >= 1 THEN
        v_achievements := v_achievements || '[{"id": "first_diary", "name": "自信紀錄", "icon": "edit_note"}]'::jsonb;
    END IF;

    -- 生成預設的棉花糖訊息
    v_marshmallow_message := '很高興看到你這段時間的成長！每一天的記錄都是自信的累積，繼續加油，我一直都在陪著你。✨';

    -- 插入或更新報告記錄
    INSERT INTO public.growth_reports (
        user_id,
        report_type,
        report_date,
        mood_data,
        growth_scores,
        achievements,
        marshmallow_message,
        summary,
        is_generated,
        updated_at
    )
    VALUES (
        p_user_id,
        p_report_type,
        v_end_date,
        COALESCE(v_mood_values, '[]'::jsonb),
        v_growth_scores,
        v_achievements,
        v_marshmallow_message,
        v_summary,
        true,
        now()
    )
    ON CONFLICT (user_id, report_type, report_date) 
    DO UPDATE SET
        mood_data = COALESCE(v_mood_values, '[]'::jsonb),
        growth_scores = v_growth_scores,
        achievements = v_achievements,
        marshmallow_message = v_marshmallow_message,
        summary = v_summary,
        is_generated = true,
        updated_at = now()
    RETURNING id INTO v_report_id;

    RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 測試函數（需要 Supabase 管理權限執行）
-- SELECT public.generate_growth_report('用戶UUID', 'monthly');

SELECT '成長報告數據庫設置完成！' as status;
