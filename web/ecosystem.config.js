module.exports = {
    apps: [
        {
            name: '11408-ai-assistant',
            script: 'npm',
            args: 'start',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                HOSTNAME: '0.0.0.0'
            },
        },
    ],
}
