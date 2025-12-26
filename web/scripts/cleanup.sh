#!/bin/bash
# 27考研助手 - 服务器清理脚本
# 建议每周执行一次

echo "=== 27考研助手 清理脚本 ==="
echo "执行时间: $(date)"

# 1. 清理 PM2 日志（保留7天）
echo "清理 PM2 日志..."
find ~/.pm2/logs -type f -mtime +7 -delete 2>/dev/null
pm2 flush 2>/dev/null

# 2. 清理 Nginx 日志（保留30天）
echo "清理 Nginx 日志..."
find /var/log/nginx -name "*.log" -mtime +30 -delete 2>/dev/null

# 3. 清理 Next.js 构建缓存（如果磁盘紧张）
# 取消下面的注释以启用
# echo "清理 Next.js 缓存..."
# rm -rf ~/kaoyan-ai-assistant/web/.next/cache

# 4. 清理系统临时文件
echo "清理系统临时文件..."
find /tmp -type f -atime +7 -delete 2>/dev/null

# 5. 显示磁盘使用情况
echo ""
echo "=== 磁盘使用情况 ==="
df -h | head -5

echo ""
echo "=== 目录占用 ==="
du -sh ~/.pm2/logs 2>/dev/null || echo "PM2 logs: 无"
du -sh ~/kaoyan-ai-assistant/web/.next 2>/dev/null || echo ".next: 无"
du -sh /var/log/nginx 2>/dev/null || echo "Nginx logs: 无"

echo ""
echo "清理完成!"
