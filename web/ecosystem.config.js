module.exports = {
    apps: [
        {
            name: '11408-ai-assistant',
            script: '.next/standalone/server.js', // Standalone build entry
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
        },
    ],
}
