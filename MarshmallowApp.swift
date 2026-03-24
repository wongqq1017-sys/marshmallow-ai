
import SwiftUI
import Combine

// MARK: - Models & Types
enum AppView {
    case welcome, login, signup1, signup2, signup3, signup4, dashboard
}

enum DashboardTab {
    case chat, explore, diary, report, settings
}

enum Tone: String, CaseIterable {
    case gentle = "溫柔鼓勵"
    case humorous = "幽默風趣"
    case rational = "理性引導"
}

enum Category: String, CaseIterable {
    case social = "社交", work = "工作", external = "外在", selfCare = "自我"
    
    var icon: String {
        switch self {
        case .social: return "person.3.fill"
        case .work: return "briefcase.fill"
        case .external: return "sparkles"
        case .selfCare: return "heart.fill"
        }
    }
}

struct DiaryEntry: Identifiable {
    let id = UUID()
    let date: Date
    let title: String
    let content: String
    let emoji: String
    let tags: [String]
}

class UserProfile: ObservableObject {
    @Published var nickname: String = ""
    @Published var email: String = ""
    @Published var tone: Tone = .gentle
    @Published var goals: Set<Category> = []
    @Published var avatarUrl: String? = nil
}

// MARK: - Theme & Helpers
extension Color {
    static let themePrimary = Color(red: 255/255, green: 159/255, blue: 67/255)
    static let candyOrange = Color(red: 255/255, green: 138/255, blue: 92/255)
    static let creamBg = Color(red: 255/255, green: 253/255, blue: 245/255)
    static let softText = Color(red: 93/255, green: 87/255, blue: 71/255)
    static let bubbleGreen = Color(red: 168/255, green: 230/255, blue: 207/255)
}

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

// MARK: - Reusable Components
struct CandyButton: View {
    let title: String
    let icon: String?
    var action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                if let icon = icon {
                    Image(systemName: icon)
                }
            }
            .font(.system(size: 20, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 64)
            .background(
                LinearGradient(gradient: Gradient(colors: [.themePrimary, .candyOrange]), startPoint: .top, endPoint: .bottom)
            )
            .cornerRadius(32)
            .shadow(color: Color.candyOrange.opacity(0.8), radius: 0, x: 0, y: 8)
        }
        .buttonStyle(BouncyButtonStyle())
    }
}

struct BouncyButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .offset(y: configuration.isPressed ? 4 : 0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

struct MarshmallowAvatar: View {
    @State private var isFloating = false
    
    var body: some View {
        ZStack {
            MarshmallowShape()
                .fill(RadialGradient(gradient: Gradient(colors: [.white, Color(hex: "FFF4E6")]), center: .topLeading, startRadius: 10, endRadius: 150))
                .overlay(MarshmallowShape().stroke(Color.white, lineWidth: 4))
                .shadow(color: Color.candyOrange.opacity(0.15), radius: 20, x: 0, y: 15)
            
            VStack(spacing: 8) {
                HStack(spacing: 24) {
                    Circle().fill(Color.softText).frame(width: 10, height: 12)
                    Circle().fill(Color.softText).frame(width: 10, height: 12)
                }
                Capsule()
                    .stroke(Color.candyOrange.opacity(0.6), lineWidth: 2)
                    .frame(width: 24, height: 6)
            }
        }
        .frame(width: 160, height: 140)
        .offset(y: isFloating ? -15 : 15)
        .onAppear {
            withAnimation(.easeInOut(duration: 3).repeatForever(autoreverses: true)) {
                isFloating = true
            }
        }
    }
}

// MARK: - Views
struct WelcomeView: View {
    var onStart: () -> Void
    
    var body: some View {
        VStack {
            HStack {
                Spacer()
                Button("跳過") { onStart() }
                    .foregroundColor(.candyOrange)
                    .padding()
            }
            
            Spacer()
            
            MarshmallowAvatar()
                .padding(.bottom, 40)
            
            Text("擁抱你的暖心時刻")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundColor(.softText)
            
            Text("就像躺在雲朵上一樣輕鬆，讓我們一起慢慢變自信吧！")
                .font(.system(.body, design: .rounded))
                .foregroundColor(.softText.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            
            Spacer()
            
            CandyButton(title: "開始幸福冒險", icon: "chevron.right", action: onStart)
                .padding(.horizontal, 30)
                .padding(.bottom, 50)
        }
        .background(Color.creamBg.ignoresSafeArea())
    }
}

struct MainDashboardView: View {
    @State private var selectedTab: DashboardTab = .chat
    @ObservedObject var profile: UserProfile
    
    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch selectedTab {
                case .chat: ChatView(profile: profile)
                case .explore: ExploreView()
                case .diary: DiaryView(profile: profile)
                case .report: ReportView()
                case .settings: SettingsView(profile: profile)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // Custom Tab Bar
            HStack {
                TabItem(icon: "bubble.left.and.bubble.right.fill", label: "AI 夥伴", isSelected: selectedTab == .chat) { selectedTab = .chat }
                TabItem(icon: "safari.fill", label: "探索", isSelected: selectedTab == .explore) { selectedTab = .explore }
                
                // Floating Diary Button
                Button(action: { selectedTab = .diary }) {
                    ZStack {
                        Circle()
                            .fill(Color.candyOrange)
                            .frame(width: 60, height: 60)
                            .shadow(color: Color.candyOrange.opacity(0.4), radius: 10, y: 5)
                        Image(systemName: "pencil.and.outline")
                            .foregroundColor(.white)
                            .font(.title2)
                    }
                }
                .offset(y: -30)
                
                TabItem(icon: "chart.bar.fill", label: "報告", isSelected: selectedTab == .report) { selectedTab = .report }
                TabItem(icon: "gearshape.fill", label: "設置", isSelected: selectedTab == .settings) { selectedTab = .settings }
            }
            .padding(.horizontal)
            .padding(.top, 10)
            .padding(.bottom, 30)
            .background(Color.white.ignoresSafeArea())
            .shadow(color: Color.black.opacity(0.05), radius: 10, y: -5)
        }
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
                Image(systemName: icon)
                    .font(.system(size: 24))
                Text(label)
                    .font(.system(size: 10, weight: .bold))
            }
            .foregroundColor(isSelected ? .candyOrange : .softText.opacity(0.3))
            .frame(maxWidth: .infinity)
        }
    }
}

struct ChatView: View {
    @ObservedObject var profile: UserProfile
    @State private var messages: [ChatMessageSwift] = [
        ChatMessageSwift(text: "嘿！今天有什麼開心的事想分享嗎？🌸", isUser: false)
    ]
    @State private var input: String = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button(action: {}) { Image(systemName: "chevron.left").foregroundColor(.softText) }
                Spacer()
                VStack(spacing: 2) {
                    Text("MY BESTIE").font(.system(size: 10, weight: .black)).foregroundColor(.candyOrange)
                    Text("棉花糖夥伴").font(.headline)
                }
                Spacer()
                Button(action: {}) { Image(systemName: "ellipsis").foregroundColor(.softText) }
            }
            .padding(.horizontal)
            .padding(.top, 60)
            .padding(.bottom, 20)
            .background(Color.creamBg)
            
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 20) {
                        ForEach(messages) { msg in
                            ChatBubbleSwift(message: msg)
                        }
                    }
                    .padding()
                }
            }
            
            // Input Area
            HStack(spacing: 12) {
                TextField("跟棉花糖聊聊...", text: $input)
                    .padding()
                    .background(Color.white)
                    .cornerRadius(25)
                    .overlay(RoundedRectangle(cornerRadius: 25).stroke(Color.bubbleGreen.opacity(0.5), lineWidth: 1))
                
                Button(action: sendMessage) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(.white)
                        .padding(12)
                        .background(Color.candyOrange)
                        .clipShape(Circle())
                }
            }
            .padding()
            .padding(.bottom, 100)
            .background(Color.white)
        }
        .background(Color.creamBg.ignoresSafeArea())
    }
    
    func sendMessage() {
        guard !input.isEmpty else { return }
        messages.append(ChatMessageSwift(text: input, isUser: true))
        input = ""
        // Logic for AI response would go here
    }
}

struct ChatMessageSwift: Identifiable {
    let id = UUID()
    let text: String
    let isUser: Bool
    let timestamp = Date()
}

struct ChatBubbleSwift: View {
    let message: ChatMessageSwift
    
    var body: some View {
        HStack {
            if message.isUser { Spacer() }
            Text(message.text)
                .padding()
                .background(message.isUser ? Color.candyOrange : Color.white)
                .foregroundColor(message.isUser ? .white : .softText)
                .font(.system(.body, design: .rounded))
                .cornerRadius(20)
                .shadow(color: Color.black.opacity(0.05), radius: 5, y: 2)
            if !message.isUser { Spacer() }
        }
    }
}

// MARK: - Root Entry
@main
struct MarshmallowAIApp: App {
    @State private var currentView: AppView = .welcome
    @StateObject var profile = UserProfile()
    
    var body: some Scene {
        WindowGroup {
            ZStack {
                switch currentView {
                case .welcome:
                    WelcomeView { currentView = .dashboard }
                case .dashboard:
                    MainDashboardView(profile: profile)
                default:
                    WelcomeView { currentView = .dashboard }
                }
            }
            .preferredColorScheme(.light)
        }
    }
}

// MARK: - Hex Color Helper
extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let b = Double(rgbValue & 0x0000FF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - View Placeholders
struct ExploreView: View { var body: some View { Text("探索畫面").font(.title).foregroundColor(.softText) } }
struct DiaryView: View { @ObservedObject var profile: UserProfile; var body: some View { Text("日記畫面").font(.title).foregroundColor(.softText) } }
struct ReportView: View { var body: some View { Text("成長報告").font(.title).foregroundColor(.softText) } }
struct SettingsView: View { @ObservedObject var profile: UserProfile; var body: some View { Text("設置").font(.title).foregroundColor(.softText) } }
