
import SwiftUI
import GenerativeAI

// --- 主題顏色定義 ---
extension Color {
    static let themePrimary = Color(hex: "#FF9F43")
    static let candyOrange = Color(hex: "#FF8A5C")
    static let creamBg = Color(hex: "#FFFDF5")
    static let softText = Color(hex: "#5D5747")
    static let bubbleGreen = Color(hex: "#A8E6CF")
}

// --- 自定義棉花糖形狀 ---
struct MarshmallowShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        path.move(to: CGPoint(x: w * 0.3, y: 0))
        path.addCurve(to: CGPoint(x: w, y: h * 0.4), control1: CGPoint(x: w * 0.7, y: 0), control2: CGPoint(x: w, y: h * 0.1))
        path.addCurve(to: CGPoint(x: w * 0.7, y: h), control1: CGPoint(x: w, y: h * 0.7), control2: CGPoint(x: w * 0.9, y: h))
        path.addCurve(to: CGPoint(x: 0, y: h * 0.6), control1: CGPoint(x: w * 0.3, y: h), control2: CGPoint(x: 0, y: h * 0.9))
        path.addCurve(to: CGPoint(x: w * 0.3, y: 0), control1: CGPoint(x: 0, y: h * 0.2), control2: CGPoint(x: w * 0.1, y: 0))
        path.closeSubpath()
        return path
    }
}

// --- 核心組件：棉花糖夥伴頭像 ---
struct MarshmallowAvatar: View {
    @State private var isAnimating = false
    var expression: String = "default"
    
    var body: some View {
        Z WE {
            MarshmallowShape()
                .fill(RadialGradient(gradient: Gradient(colors: [.white, .creamBg]), center: .topLeading, startRadius: 10, endRadius: 100))
                .overlay(MarshmallowShape().stroke(Color.white, lineWidth: 4))
                .shadow(color: Color.candyOrange.opacity(0.15), radius: 20, x: 0, y: 10)
            
            VStack(spacing: 8) {
                HStack(spacing: 20) {
                    Circle().fill(Color.softText).frame(width: 8, height: 10)
                    Circle().fill(Color.softText).frame(width: 8, height: 10)
                }
                Capsule()
                    .stroke(Color.softText.opacity(0.4), lineWidth: 2)
                    .frame(width: 20, height: 4)
            }
        }
        .frame(width: 120, height: 100)
        .offset(y: isAnimating ? -10 : 0)
        .onAppear {
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }
}

// --- 主介面容器 ---
struct MainDashboardView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            ChatTabView()
                .tabItem {
                    Label("AI 夥伴", systemImage: "bubble.left.and.bubble.right.fill")
                }.tag(0)
            
            ExploreTabView()
                .tabItem {
                    Label("心靈探索", systemImage: "safari.fill")
                }.tag(1)
            
            DiaryTabView()
                .tabItem {
                    Label("日記", systemImage: "pencil.and.outline")
                }.tag(2)
        }
        .accentColor(.candyOrange)
        .onAppear {
            // iOS 介面優化：設置 TabBar 背景色
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(Color.white.opacity(0.9))
            UITabBar.appearance().standardAppearance = appearance
        }
    }
}

// --- 聊天介面視圖 ---
struct ChatTabView: View {
    @State private var messageText: String = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack {
                Text("棉花糖夥伴").font(.headline).foregroundColor(.softText)
                MarshmallowAvatar().scaleEffect(0.6).frame(height: 60)
            }
            .padding(.top, 50)
            .frame(maxWidth: .infinity)
            .background(Color.creamBg)
            
            // Chat Content
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ChatBubble(text: "嘿！今天感覺如何呢？🌸", isUser: false)
                }
                .padding()
            }
            
            // Input Area
            HStack(spacing: 12) {
                TextField("跟棉花糖聊聊...", text: $messageText)
                    .padding()
                    .background(Color.white)
                    .cornerRadius(25)
                    .overlay(RoundedRectangle(cornerRadius: 25).stroke(Color.candyOrange.opacity(0.1), lineWidth: 1))
                
                Button(action: {}) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.candyOrange)
                        .clipShape(Circle())
                }
            }
            .padding()
            .background(Color.white)
        }
        .edgesIgnoringSafeArea(.top)
        .background(Color.creamBg)
    }
}

struct ChatBubble: View {
    let text: String
    let isUser: Bool
    
    var body: some View {
        HStack {
            if isUser { Spacer() }
            Text(text)
                .padding(15)
                .background(isUser ? Color.candyOrange : Color.white)
                .foregroundColor(isUser ? .white : .softText)
                .cornerRadius(20, corners: isUser ? [.topLeft, .bottomLeft, .topRight] : [.topRight, .bottomRight, .bottomLeft])
                .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
            if !isUser { Spacer() }
        }
    }
}

// --- Helper: Hex Color ---
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

// --- Helper: Specific Corners Radius ---
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners
    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}
