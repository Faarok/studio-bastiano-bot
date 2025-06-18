const encoder = new TextEncoder();

function hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes.buffer;
}

async function verifyKey(body, signature, timestamp, publicKey) {
    const data = encoder.encode(timestamp + body);
    const signatureBuffer = hexToBuffer(signature);
    const keyBuffer = hexToBuffer(publicKey);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "Ed25519" },
        false,
        ["verify"]
    );


    return crypto.subtle.verify("Ed25519", cryptoKey, signatureBuffer, data);
}

// Charge tes citations depuis JSON
import quotes from './quotes.json' assert { type: 'json' };

export default {
    async fetch(request, env) {
        const signature = request.headers.get('x-signature-ed25519');
        const timestamp = request.headers.get('x-signature-timestamp');
        const body = await request.text();

        if (!signature || !timestamp) {
            return new Response('Unauthorized', { status: 401 });
        }

        const isValid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);

        if (!isValid) {
            return new Response('Invalid request signature', { status: 401 });
        }

        const interaction = JSON.parse(body);

        // Pong pour vérifier endpoint
        if (interaction.type === 1) {
            return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Commande /quote
        if (interaction.type === 2 && interaction.data.name === 'quote') {
            const index = crypto.getRandomValues(new Uint32Array(1))[0] % quotes.length;
            const quote = quotes[index];

            return new Response(JSON.stringify({
                type: 4,
                data: { content: quote }
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        return new Response('Unknown interaction', { status: 400 });
    }
};
