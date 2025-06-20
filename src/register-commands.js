// register-commands.js
import { REST, Routes } from 'discord.js';
import 'dotenv/config';

const commands = [
    {
        name: 'quote',
        description: 'Envoie une citation forte et persévérante.',
        "options": [
            {
                "name": "tts",
                "description": "Envoyer la citation avec TSS",
                "type": 5,  // 5 = boolean
                "required": false
            }
        ]
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
    { body: commands }
).then(() => {
    console.log('✅ Commande /quote enregistrée !');
}).catch(console.error);