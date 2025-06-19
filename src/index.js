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
            return new Exception('Unauthorized', { status: 401 });
        }

        if (!env.DISCORD_PUBLIC_KEY) {
            return new Exception('Server misconfiguration: missing public key', { status: 500 });
        }

        try {
            const isValid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
            if (!isValid) {
                return new Exception('Invalid request signature', { status: 401 });
            }
        } catch (e) {
            return new Exception('Error verifying signature: ' + e.message, { status: 500 });
        }

        const interaction = JSON.parse(body);

        // Pong pour vérifier endpoint
        if (interaction.type === 1) {
            return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Commande /quote
        if(interaction.type === 2 && interaction.data.name === 'quote')
        {
            // 1. Récupérer les citations déjà utilisées depuis KV
            const list = await env.USED_QUOTES.list({ prefix: 'used-quote-' });
            const usedIds = list.keys.map(k => parseInt(k.name.split('used-quote-')[1]));

            // 2. Filtrer les citations non utilisées
            let unusedQuotes = quotes.filter(q => !usedIds.includes(q.id));

            // 3. Si toutes utilisées, reset la KV (suppression des clés)
            if(unusedQuotes.length === 0)
            {
                // Supprime toutes les clés used-quote-*
                await Promise.all(list.keys.map(k => env.USED_QUOTES.delete(k.name)));
                unusedQuotes = quotes; // on repart à zéro
            }

            // 4. Choisir une citation aléatoire
            const index = crypto.getRandomValues(new Uint32Array(1))[0] % unusedQuotes.length;
            const quote = unusedQuotes[index];

            // 5. Marquer la citation comme utilisée dans KV
            await env.USED_QUOTES.put(`used-quote-${quote.id}`, 'true');

            return new Response(JSON.stringify({
                type: 4,
                data: { content: quote.text }
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        return new Response('Unknown interaction', { status: 400 });
    }
};
