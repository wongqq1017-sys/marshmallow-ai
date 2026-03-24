
import SwiftUI
import Combine

// MARK: - 主題顏色定義 (1:1 還原 Web Palette)
extension Color {
    static let themePrimary = Color(hex: "#FF9F43")
    static let candyOrange = Color(hex: "#FF8A5C")
    static let creamBg = Color(hex: "#FFFDF5")
    static let softText = Color(hex: "#5D5747")
    static let bubbleGreen = Color(hex: "#A8E6CF")
    static let mintGlow = Color(hex: "#D1F2E8")
    static let userChat = Color(hex: "#FFEFD5")
}

// MARK: - 自定義 Marshmallow 形狀 (使用貝茲曲線)
struct MarshmallowShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        path.move(to: CGPoint(x: w * 0.3, y: 0))
        path.addCurve(to: CGPoint(x: w * 0.9, y: h * 0.1), control1: CGPoint(x: w * 0.6, y: -0.05 * h), control2: CGPoint(x: w * 0.8, y: 0))
        path.addCurve(to: CGPoint(x: w, y: h * 0.5), control1: CGPoint(x: w * 1.05, y: h * 0.2), control2: CGPoint(x: w, y: h * 0.4))
        path.addCurve(to: CGPoint(x: w * 0.7, y: h), control1: CGPoint(x: w, y: h * 0.8), control2: CGPoint(x: w * 0.9, y: h))
        path.addCurve(to: CGPoint(x: 0, y: h * 0.7), control1: CGPoint(x: w * 0.3, y: h * 1.05), control2: CGPoint(x: 0, y: h * 0.9))
        path.addCurve(to: CGPoint(x: w * 0.3, y: 0), control1: CGPoint(x: -0.05 * w, y: h * 0.3), control2: CGPoint(x: w * 0.1, y: 0))
        path.closeSubpath()
        return path
    }
}

// MARK: - 核心組件：動態棉花糖夥伴
struct MarshmallowPartner: View {
    @State private var isFloating = false
    @State private var blink = false
    var size: CGFloat = 120
    
    var body: some View {
        ZStack {
            // 軟綿綿主體
            MarshmallowShape()
                .fill(RadialGradient(gradient: Gradient(colors: [.white, Color(hex: "FFF4E6")]), center: .topLeading, startRadius: 10, endRadius: size))
                .overlay(MarshmallowShape().stroke(Color.white, lineWidth: 4))
                .shadow(color: Color.candyOrange.opacity(0.15), radius: 20, x: 0, y: 15)
            
            // 五官
            VStack(spacing: 6) {
                HStack(spacing: 20) {
                    Circle().fill(Color.softText).frame(width: 8, height: blink ? 1 : 10)
                    Circle().fill(Color.softText).frame(width: 8, height: blink ? 1 : 10)
                }
                .animation(.easeInOut(duration: 0.1), value: blink)
                
                Capsule()
                    .stroke(Color.candyOrange.opacity(0.4), lineWidth: 2)
                    .frame(width: 20, height: 4)
            }
        }
        .frame(width: size, height: size * 0.85)
        .offset(y: isFloating ? -10 : 10)
        .onAppear {
            withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) {
                isFloating = true
            }
            // 隨機眨眼
            Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { _ in
                blink = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { blink = false }
            }
        }
    }
}

// MARK: - 100% 還原按鈕樣式 (Candy Button)
struct CandyButton: View {
    let title: String
    var icon: String? = nil
    var action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(title)
                if let icon = icon { Image(systemName: icon) }
            }
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(
                LinearGradient(gradient: Gradient(colors: [Color(hex: "FFB067"), Color.candyOrange]), startPoint: .top, endPoint: .bottom)
            )
            .cornerRadius(25)
            .shadow(color: Color(hex: "E67E22").opacity(0.8), radius: 0, x: 0, y: 6)
        }
        .buttonStyle(PlainButtonStyle())
        .pressEvents(onPress: { }, onRelease: { }) // 模擬 active:translate-y-1
    }
}

// MARK: - 主介面導航 (Dashboard)
struct MainTabView: View {
    @State private var selectedTab: Int = 0
    
    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                ChatView().tag(0)
                ExploreView().tag(1)
                DiaryView().tag(2)
                ReportView().tag(3)
                SettingsView().tag(4)
            }
            
            // 自定義 TabBar 
            HStack {
                TabItem(icon: "bubble.left.and.bubble.right.fill", label: "AI 夥伴", isSelected: selectedTab == 0) { selectedTab = 0 }
                TabItem(icon: "safari.fill", label: "心靈探索", isSelected: selectedTab == 1) { selectedTab = 1 }
                
                // 懸浮日記按鈕
                Button(action: { selectedTab = 2 }) {
                    ZStack {
                        Circle().fill(Color.candyOrange).frame(width: 56, height: 56)
                            .shadow(color: Color.candyOrange.opacity(0.4), radius: 10, y: 5)
                        Image(systemName: "pencil.and.outline").foregroundColor(.white).font(.title2)
                    }
                }
                .offset(y: -28)
                
                TabItem(icon: "chart.bar.fill", label: "報告", isSelected: selectedTab == 3) { selectedTab = 3 }
                TabItem(icon: "gearshape.fill", label: "設置", isSelected: selectedTab == 4) { selectedTab = 4 }
            }
            .padding(.horizontal)
            .padding(.top, 12)
            .padding(.bottom, 34)
            .background(Color.white.shadow(color: Color.black.opacity(0.05), radius: 10, y: -5))
        }
        .edgesIgnoringSafeArea(.bottom)
    }
}

struct TabItem: View {
    let icon: String
    let label: String
    let isSelected: Bool
    var action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 22))
                Text(label).font(.system(size: 10, weight: .bold))
            }
            .foregroundColor(isSelected ? .candyOrange : .softText.opacity(0.3))
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - 聊天室畫面 (ChatView)
struct ChatView: View {
    @State private var message: String = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 8) {
                Text("MY BESTIE").font(.system(size: 10, weight: .black)).foregroundColor(.candyOrange).tracking(2)
                Text("棉花糖夥伴").font(.system(.headline, design: .rounded))
                MarshmallowPartner(size: 70).padding(.bottom, 10)
            }
            .padding(.top, 60)
            .frame(maxWidth: .infinity)
            .background(Color.creamBg)
            
            // 對話區域
            ScrollView {
                VStack(spacing: 16) {
                    ChatBubble(text: "嘿！今天有什麼開心的事想分享嗎？🌸", isUser: false)
                }
                .padding()
            }
            .background(Color.creamBg)
            
            // 輸入框
            HStack(spacing: 12) {
                TextField("跟棉花糖聊聊...", text: $message)
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(25)
                    .overlay(RoundedRectangle(cornerRadius: 25).stroke(Color.candyOrange.opacity(0.1), lineWidth: 1))
                
                Button(action: {}) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(.white)
                        .padding(14)
                        .background(Color.candyOrange)
                        .clipShape(Circle())
                }
            }
            .padding()
            .padding(.bottom, 100)
            .background(Color.white)
        }
        .edgesIgnoringSafeArea(.top)
    }
}

struct ChatBubble: View {
    let text: String
    let isUser: Bool
    
    var body: some View {
        HStack {
            if isUser { Spacer() }
            Text(text)
                .font(.system(.body, design: .rounded))
                .padding(16)
                .background(isUser ? Color.candyOrange : Color.white)
                .foregroundColor(isUser ? .white : .softText)
                .cornerRadius(20)
                .shadow(color: Color.black.opacity(0.03), radius: 5, y: 2)
            if !isUser { Spacer() }
        }
    }
}

// MARK: - Helper: Hex Color
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: Double(a) / 255)
    }
}

// MARK: - Placeholder Views
struct ExploreView: View { var body: some View { Color.creamBg.overlay(Text("心靈探索內容").font(.headline)) } }
struct DiaryView: View { var body: some View { Color.creamBg.overlay(Text("自信日記歷程").font(.headline)) } }
struct ReportView: View { var body: some View { Color.creamBg.overlay(Text("成長報告圖表").font(.headline)) } }
struct SettingsView: View { var body: some View { Color.creamBg.overlay(Text("帳號設置").font(.headline)) } }

// MARK: - App Entry
@main
struct MarshmallowAIApp: App {
    var body: some Scene {
        WindowGroup {
            MainTabView()
                .preferredColorScheme(.light)
        }
    }
}

// 模擬點擊縮放效果
extension View {
    func pressEvents(onPress: @escaping (() -> Void), onRelease: @escaping (() -> Void)) -> some View {
        self.simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged({ _ in onPress() })
                .onEnded({ _ in onRelease() })
        )
    }
}
