-- 管理员后台所需的数据库扩展
-- 请在 Supabase SQL Editor 中执行

-- 1. 用户活动日志表
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  action_type text NOT NULL, -- 'login', 'upload_mistake', 'chat', 'api_call', 'upload_reference'
  metadata jsonb DEFAULT '{}', -- 额外信息
  created_at timestamptz DEFAULT now()
);

-- 为活动日志添加索引
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON user_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_action_type ON user_activity_logs(action_type);

-- 2. API 调用统计表
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  api_name text NOT NULL, -- 'deepseek_chat', 'ocr_analysis', 'embedding'
  tokens_used int DEFAULT 0,
  cost_estimate decimal(10,4) DEFAULT 0, -- 预估费用（元）
  request_duration_ms int DEFAULT 0, -- 请求耗时
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_created_at ON api_usage_logs(created_at);

-- 3. 管理员表
CREATE TABLE IF NOT EXISTS admins (
  user_id uuid REFERENCES auth.users PRIMARY KEY,
  role text DEFAULT 'admin', -- 'admin', 'super_admin'
  created_at timestamptz DEFAULT now()
);

-- 4. RLS 策略 - 用户只能看自己的活动日志
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON user_activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity" ON user_activity_logs
  FOR INSERT WITH CHECK (true);

-- 5. RLS 策略 - 用户只能看自己的 API 使用
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api usage" ON api_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert api usage" ON api_usage_logs
  FOR INSERT WITH CHECK (true);

-- 6. 管理员表 RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin list" ON admins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid())
  );

-- 7. 创建管理员统计视图
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM user_activity_logs WHERE created_at > NOW() - INTERVAL '24 hours') as daily_active_actions,
  (SELECT COUNT(*) FROM mistakes) as total_mistakes,
  (SELECT COUNT(*) FROM references_kb) as total_references,
  (SELECT COUNT(*) FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '24 hours') as daily_api_calls,
  (SELECT COALESCE(SUM(cost_estimate), 0) FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '30 days') as monthly_cost_estimate;

-- 8. 用户统计视图
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id as user_id,
  u.email,
  u.created_at as registered_at,
  (SELECT COUNT(*) FROM mistakes WHERE user_id = u.id) as mistake_count,
  (SELECT COUNT(*) FROM references_kb WHERE user_id = u.id) as reference_count,
  (SELECT MAX(created_at) FROM user_activity_logs WHERE user_id = u.id) as last_active_at
FROM auth.users u;

-- 注意：执行此 SQL 后，需要手动添加第一个管理员
-- 在 Supabase 中执行：
-- INSERT INTO admins (user_id) VALUES ('您的 user_id');
