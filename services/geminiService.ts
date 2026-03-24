// Marshmallow AI Service
// 這是主要的服务入口，底層使用 DeepSeek API
// 如需修改 AI 提供商，請修改 deepseekService.ts

export { 
  createMarshmallowChat, 
  sendMessage, 
  sendExploreVoiceMessage,
  generateAffirmation,
  generateVisualization,
  type MarshmallowChat 
} from './deepseekService';
