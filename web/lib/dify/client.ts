export class DifyClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string, baseUrl: string = 'https://api.dify.ai/v1') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    async fileUpload(formData: FormData) {
        const response = await fetch(`${this.baseUrl}/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: formData,
        });
        return response.json();
    }

    async runWorkflow(inputs: Record<string, any>, user: string, files: any[] = []) {
        const response = await fetch(`${this.baseUrl}/workflows/run`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs,
                response_mode: 'blocking',
                user,
                files
            }),
        });
        return response.json();
    }
}

export const dify = new DifyClient(process.env.DIFY_API_KEY!);
