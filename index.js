require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const express = require('express');
const puppeteer = require('puppeteer');

// ============================
// 🔐 CONFIGURACIÓN
// ============================
const CONFIG = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

    BUSINESS_NAME: process.env.BUSINESS_NAME || 'Scala',
    BOT_NAME: process.env.BOT_NAME || 'Scala',

    KIT_LINK: process.env.KIT_LINK || '[ENLACE DEL KIT GRATUITO]',
    HOTMART_LINK: process.env.HOTMART_LINK || '[ENLACE DE HOTMART]',

    MINIPACK_PATH: process.env.MINIPACK_PATH || './minipack.zip',

    COOLDOWN_MS: Number(process.env.COOLDOWN_MS || 3000),
    SESSION_PATH: process.env.WWEBJS_AUTH_PATH || '.wwebjs_auth',
};

if (!CONFIG.GEMINI_API_KEY) {
    console.error('❌ Falta GEMINI_API_KEY en el archivo .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(CONFIG.GEMINI_API_KEY);

// ============================
// 🧠 PROMPT DE IA
// ============================
const SYSTEM_PROMPT = `
Eres Scala, el asistente oficial de Scala 🌈.

Scala ofrece materiales cristianos infantiles para familias, niños, maestros, iglesias y ministerios.

Tu estilo debe ser:
- Breve
- Cálido
- Profesional
- Cristiano
- Estratégico
- Natural, como conversación real de WhatsApp

Debes entender mensajes vagos, normales, detallados o avanzados de padres y madres.

Scala ofrece:
- MiniPack Scala de muestra
- Kit gratuito: 3 noches de paz con Dios
- Pack Scala Familiar
- Pastor Scala
- Cuentos cristianos
- Alabanzas para dormir
- Oraciones
- Rutinas familiares
- Material imprimible
- Programa de promotores con comisión del 50%

Reglas:
1. Responde máximo en 3 líneas.
2. No inventes precios, enlaces ni beneficios.
3. Si preguntan por comprar, invita al Pack Scala Familiar.
4. Si preguntan por promotores, menciona comisión del 50%.
5. Si preguntan por muestra, demo, archivo, producto, material o MiniPack, diles que escriban: minipack.
6. Si son padres preocupados por pantallas, sueño, miedo, ansiedad, berrinches o rutina nocturna, responde con empatía y ofrece el MiniPack.
7. Si el mensaje no tiene relación con Scala, responde exactamente: [SILENCIO].
`.trim();

const model = genAI.getGenerativeModel({
    model: CONFIG.GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 180,
    },
});

// ============================
// 🌐 SERVIDOR WEB PARA RENDER
// ============================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('BOTCUENTOSSCALA funcionando correctamente ✅');
});

app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        bot: 'BOTCUENTOSSCALA',
        time: new Date().toISOString(),
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor web activo en puerto ${PORT}`);
});

// ============================
// ⚙️ WHATSAPP / CHROME PARA RENDER
// ============================
function buscarChromeEnCarpeta(carpetaBase) {
    try {
        if (!fs.existsSync(carpetaBase)) return null;

        const elementos = fs.readdirSync(carpetaBase, { withFileTypes: true });

        for (const elemento of elementos) {
            const rutaCompleta = path.join(carpetaBase, elemento.name);

            if (elemento.isDirectory()) {
                const encontrado = buscarChromeEnCarpeta(rutaCompleta);
                if (encontrado) return encontrado;
            }

            if (
                elemento.isFile() &&
                (
                    elemento.name === 'chrome' ||
                    elemento.name === 'chrome.exe' ||
                    elemento.name === 'chromium' ||
                    elemento.name === 'chromium-browser'
                )
            ) {
                return rutaCompleta;
            }
        }

        return null;
    } catch (error) {
        console.error(`❌ Error buscando Chrome: ${error.message}`);
        return null;
    }
}

function obtenerChromePath() {
    const posiblesRutas = [];

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        posiblesRutas.push(process.env.PUPPETEER_EXECUTABLE_PATH);
    }

    try {
        const rutaPuppeteer = puppeteer.executablePath();
        posiblesRutas.push(rutaPuppeteer);
    } catch (error) {
        console.warn(`⚠️ Puppeteer no dio ruta automática: ${error.message}`);
    }

    posiblesRutas.push('/usr/bin/google-chrome');
    posiblesRutas.push('/usr/bin/google-chrome-stable');
    posiblesRutas.push('/usr/bin/chromium');
    posiblesRutas.push('/usr/bin/chromium-browser');

    for (const ruta of posiblesRutas) {
        if (ruta && fs.existsSync(ruta)) {
            console.log(`✅ Chrome encontrado en: ${ruta}`);
            return ruta;
        } else if (ruta) {
            console.warn(`⚠️ Ruta probada pero no existe: ${ruta}`);
        }
    }

    const carpetasParaBuscar = [
        path.join(__dirname, '.cache', 'puppeteer'),
        '/opt/render/project/src/.cache/puppeteer',
        '/opt/render/.cache/puppeteer',
        '/opt/render/project/.cache/puppeteer',
    ];

    for (const carpeta of carpetasParaBuscar) {
        console.log(`🔎 Buscando Chrome dentro de: ${carpeta}`);
        const encontrado = buscarChromeEnCarpeta(carpeta);

        if (encontrado && fs.existsSync(encontrado)) {
            console.log(`✅ Chrome encontrado manualmente en: ${encontrado}`);
            return encontrado;
        }
    }

    console.warn('⚠️ No se encontró Chrome. Render puede fallar al iniciar WhatsApp Web.');
    return undefined;
}

const chromePath = obtenerChromePath();

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: CONFIG.SESSION_PATH,
    }),
    puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--metrics-recording-only',
            '--mute-audio',
            '--hide-scrollbars',
            '--disable-features=site-per-process',
            '--disable-web-security',
        ],
    },
});

// ============================
// 📊 LOGS
// ============================
const log = {
    info: (msg) => console.log(`ℹ️ ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️ ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
};

// ============================
// 💬 MENSAJES PRINCIPALES
// ============================
const MENSAJES = {
    saludo: `Hola 😊 Bienvenido a *Scala*.

Soy Scala, tu asistente cristiano familiar.

Tenemos materiales cristianos infantiles para ayudar a crear noches más tranquilas, con menos pantallas y más paz en familia.`,

    preguntaIntencion: `Antes de enviarte el material correcto, dime por favor:

¿Para quién buscas este recurso?

1️⃣ Para mi hijo/a
2️⃣ Para mis estudiantes
3️⃣ Para mi iglesia o ministerio infantil
4️⃣ Para regalar`,

    preguntaEdad: `Gracias 🙌

Ahora dime, ¿qué edad tiene el pequeño?

1️⃣ 3 a 5 años
2️⃣ 6 a 8 años
3️⃣ 9 a 12 años`,

    entregaKit: `Perfecto 🙌 Aquí tienes tu Kit gratuito: *3 noches de paz con Dios*.

📥 ${CONFIG.KIT_LINK}

También puedo enviarte un *MiniPack de muestra* para que veas cómo es el producto por dentro. Solo escribe: *minipack*.`,

    pastorScala: `Además, en *Scala* contamos con *Pastor Scala*, un asistente cristiano para padres y familias.

Puede ayudarte con ideas de oración, rutinas de descanso, uso de pantallas y acompañamiento espiritual en casa.`,

    presentacionPack: `También tenemos el *Pack Scala Familiar: Noches de Paz con Dios*.

Incluye cuentos cristianos, alabanzas para dormir, ebooks ilustrados, oraciones, material imprimible, Revista Scala y acceso a Pastor Scala.

¿Quieres que te muestre el paquete completo?`,

    enlaceVenta: `Aquí puedes conocer el *Pack Scala Familiar: Noches de Paz con Dios*:

${CONFIG.HOTMART_LINK}

Está disponible en precio de lanzamiento por tiempo limitado.`,

    promotor: `💼 También puedes formar parte del programa de promotores de *Scala*.

Ganas el *50% de comisión* por cada venta realizada con tu enlace.

¿Quieres que te explique cómo activarte como promotor?`,

    humano: `Perfecto 🙌 Te pondremos en contacto con una persona del equipo de *Scala* para ayudarte mejor.`,

    noInteres: `Está bien 😊 Puedes usar el material con calma.

Cuando quieras conocer el Pack Scala Familiar, solo escríbeme: *pack*.`,

    menu: `Hola 😊 Soy *Scala*.

Puedo ayudarte con:

1️⃣ Recibir el MiniPack de muestra
2️⃣ Recibir el kit gratuito
3️⃣ Conocer el Pack Scala Familiar
4️⃣ Saber sobre Pastor Scala
5️⃣ Ser promotor y ganar comisión`,

    miniPackIntro: `Claro que sí 😊

Te envío el *MiniPack Scala* para que puedas ver cómo es el producto por dentro.`,

    miniPackCaption: `🎁 Aquí tienes el *MiniPack Scala*.

Es una muestra del material cristiano infantil para crear una rutina más tranquila, espiritual y familiar antes de dormir.

Cuando quieras ver el paquete completo, escríbeme: *pack*.`,

    miniPackError: `Perdón 🙏 No pude enviar el archivo en este momento.

Verifica que el archivo *minipack.zip* esté en la carpeta principal del bot y vuelve a escribir: *minipack*.`,
};

// ============================
// 🧠 ESTADOS DEL USUARIO
// ============================
const conversaciones = new Map();
const cooldowns = new Map();
const procesando = new Set();

const ESTADOS = {
    INICIO: 'inicio',
    ESPERANDO_INTENCION: 'esperando_intencion',
    ESPERANDO_EDAD: 'esperando_edad',
    PACK_OFRECIDO: 'pack_ofrecido',
    VENTA_ENVIADA: 'venta_enviada',
    PROMOTOR: 'promotor',
    HUMANO: 'humano',
};

function obtenerEstado(userId) {
    if (!conversaciones.has(userId)) {
        conversaciones.set(userId, {
            estado: ESTADOS.INICIO,
            datos: {},
            actualizado: Date.now(),
        });
    }

    return conversaciones.get(userId);
}

function guardarEstado(userId, nuevoEstado, datosExtra = {}) {
    const actual = obtenerEstado(userId);

    conversaciones.set(userId, {
        estado: nuevoEstado,
        datos: {
            ...actual.datos,
            ...datosExtra,
        },
        actualizado: Date.now(),
    });
}

function reiniciarEstado(userId) {
    conversaciones.set(userId, {
        estado: ESTADOS.INICIO,
        datos: {},
        actualizado: Date.now(),
    });
}

setInterval(() => {
    const ahora = Date.now();
    const TIEMPO_MAXIMO = 24 * 60 * 60 * 1000;

    for (const [userId, data] of conversaciones.entries()) {
        if (ahora - data.actualizado > TIEMPO_MAXIMO) {
            conversaciones.delete(userId);
        }
    }
}, 30 * 60 * 1000);

// ============================
// 🧹 UTILIDADES
// ============================
function normalize(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function limpiarTexto(text) {
    return normalize(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
    return Math.floor(Math.random() * 900) + 900;
}

function contiene(texto, palabras) {
    return palabras.some(palabra => texto.includes(palabra));
}

function estaEnCooldown(userId) {
    const ultimo = cooldowns.get(userId);
    if (!ultimo) return false;

    return Date.now() - ultimo < CONFIG.COOLDOWN_MS;
}

function activarCooldown(userId) {
    cooldowns.set(userId, Date.now());
}

function obtenerRutaMiniPack() {
    const ruta = CONFIG.MINIPACK_PATH;

    if (path.isAbsolute(ruta)) {
        return ruta;
    }

    return path.resolve(__dirname, ruta);
}

// ============================
// 🔎 DETECCIÓN DE INTENCIONES
// ============================
function esSaludo(texto) {
    const t = limpiarTexto(texto);

    return (
        t === 'hola' ||
        t === 'buenas' ||
        t.includes('hola') ||
        t.includes('buen dia') ||
        t.includes('buenos dias') ||
        t.includes('buenas tardes') ||
        t.includes('buenas noches') ||
        t.includes('hey') ||
        t.includes('hi')
    );
}

function quiereKit(texto) {
    const t = limpiarTexto(texto);

    return contiene(t, [
        'kit',
        'gratis',
        'gratuito',
        '3 noches',
        'tres noches',
        'paz con dios',
        'cuento',
        'cuentos',
        'dormir',
        'material',
        'recurso',
        'devocional',
        'oracion',
        'oración',
        'alabanza',
    ]);
}

function quiereMiniPack(texto) {
    const t = limpiarTexto(texto);

    return contiene(t, [
        'minipack',
        'mini pack',
        'mini-pack',
        'quiero el minipack',
        'quiero mini pack',
        'quiero la muestra',
        'mandame la muestra',
        'mándame la muestra',
        'enviame la muestra',
        'envíame la muestra',
        'quiero ver el producto',
        'quiero ver como es',
        'ver como es el producto',
        'quieres el minipack para ver como es el producto',
        'muestra del producto',
        'producto de muestra',
        'demo',
        'demostracion',
        'demostración',
        'archivo',
        'archivo zip',
        'zip',
        'descargar',
        'descarga',
        'mandame el archivo',
        'mándame el archivo',
        'enviame el archivo',
        'envíame el archivo',
        'ver el contenido',
        'ver por dentro',
        'como es el material',
        'cómo es el material',
        'ejemplo del material',
        'probar el material',
        'quiero probar',
        'quiero verlo primero',
        'antes de comprar',
        'me pasas algo',
        'me muestras',
        'tienes muestra',
        'tiene muestra',
    ]);
}

function esPadreConProblema(texto) {
    const t = limpiarTexto(texto);

    const palabrasPadres = [
        'mi hijo',
        'mi hija',
        'mi niño',
        'mi niña',
        'mi pequeno',
        'mi pequeña',
        'mis hijos',
        'mis ninos',
        'mis niños',
        'soy mama',
        'soy mamá',
        'soy papa',
        'soy papá',
        'padre',
        'madre',
        'mamita',
        'papito',
    ];

    const problemas = [
        'no duerme',
        'no quiere dormir',
        'duerme tarde',
        'pantalla',
        'celular',
        'tablet',
        'youtube',
        'miedo',
        'pesadilla',
        'ansiedad',
        'llora',
        'berrinche',
        'inquieto',
        'inquieta',
        'rutina',
        'noche',
        'dormir',
        'oracion',
        'oración',
        'cuento',
        'calmar',
        'tranquilo',
        'tranquila',
        'no se calma',
        'mucho celular',
        'mucho telefono',
        'mucho teléfono',
    ];

    return contiene(t, palabrasPadres) && contiene(t, problemas);
}

function quierePack(texto) {
    const t = limpiarTexto(texto);

    return contiene(t, [
        'pack',
        'paquete',
        'precio',
        'comprar',
        'hotmart',
        'lanzamiento',
        'quiero comprar',
        'quiero verlo',
        'mostrar paquete',
        'muestrame',
        'muéstrame',
        'cuanto cuesta',
        'cuánto cuesta',
        'valor',
        'pagar',
        'metodo de pago',
        'método de pago',
        'producto completo',
        'paquete completo',
    ]);
}

function quierePromotor(texto) {
    const t = limpiarTexto(texto);

    return contiene(t, [
        'promotor',
        'comision',
        'comisión',
        'ganar',
        'vender',
        'afiliado',
        'negocio',
        'ingresos',
        'revender',
        'venta',
        'ventas',
    ]);
}

function quiereHumano(texto) {
    const t = limpiarTexto(texto);

    return contiene(t, [
        'asesor',
        'persona',
        'humano',
        'atencion',
        'atención',
        'ejecutivo',
        'hablar con alguien',
        'quiero hablar',
        'soporte',
        'ayuda personalizada',
    ]);
}

function esSi(texto) {
    const t = limpiarTexto(texto);

    return (
        t === 'si' ||
        t === 'sí' ||
        t === 'ok' ||
        t === 'dale' ||
        t === 'claro' ||
        t === 'quiero' ||
        t === 'me interesa' ||
        t.includes('me interesa') ||
        t.includes('quiero verlo') ||
        t.includes('quiero el paquete') ||
        t.includes('muestrame') ||
        t.includes('muéstrame') ||
        t.includes('envialo') ||
        t.includes('envíalo') ||
        t.includes('mandalo') ||
        t.includes('mándalo')
    );
}

function esNo(texto) {
    const t = limpiarTexto(texto);

    return (
        t === 'no' ||
        t.includes('no gracias') ||
        t.includes('por ahora no') ||
        t.includes('despues') ||
        t.includes('después')
    );
}

function detectarIntencionMaterial(texto) {
    const t = limpiarTexto(texto);

    if (t === '1' || t.includes('hijo') || t.includes('hija') || t.includes('niño') || t.includes('niña')) {
        return 'Para mi hijo/a';
    }

    if (t === '2' || t.includes('estudiante') || t.includes('alumnos') || t.includes('curso') || t.includes('colegio')) {
        return 'Para mis estudiantes';
    }

    if (t === '3' || t.includes('iglesia') || t.includes('ministerio') || t.includes('escuela dominical')) {
        return 'Para mi iglesia o ministerio infantil';
    }

    if (t === '4' || t.includes('regalar') || t.includes('regalo')) {
        return 'Para regalar';
    }

    return null;
}

function detectarEdad(texto) {
    const t = limpiarTexto(texto);

    if (t === '1') return '3 a 5 años';
    if (t === '2') return '6 a 8 años';
    if (t === '3') return '9 a 12 años';

    const numeros = t.match(/\d+/g);

    if (!numeros) return null;

    const edad = Number(numeros[0]);

    if (edad >= 3 && edad <= 5) return '3 a 5 años';
    if (edad >= 6 && edad <= 8) return '6 a 8 años';
    if (edad >= 9 && edad <= 12) return '9 a 12 años';

    return null;
}

// ============================
// ✉️ ENVÍO DE MENSAJES
// ============================
async function enviarMensajes(chatId, mensajes = []) {
    const chat = await client.getChatById(chatId);

    for (const mensaje of mensajes) {
        await chat.sendStateTyping();
        await sleep(randomDelay());
        await client.sendMessage(chatId, mensaje);
        await sleep(600);
    }
}

// ============================
// 📦 ENVÍO DEL MINIPACK ZIP
// ============================
async function enviarMiniPack(chatId) {
    try {
        const rutaMiniPack = obtenerRutaMiniPack();

        log.info(`Buscando MiniPack en: ${rutaMiniPack}`);

        if (!fs.existsSync(rutaMiniPack)) {
            log.error(`El archivo no existe en la ruta: ${rutaMiniPack}`);
            await client.sendMessage(chatId, MENSAJES.miniPackError);
            return false;
        }

        const stats = fs.statSync(rutaMiniPack);

        if (!stats.isFile()) {
            log.error(`La ruta existe pero no es archivo: ${rutaMiniPack}`);
            await client.sendMessage(chatId, MENSAJES.miniPackError);
            return false;
        }

        if (stats.size <= 0) {
            log.error(`El ZIP está vacío: ${rutaMiniPack}`);
            await client.sendMessage(chatId, MENSAJES.miniPackError);
            return false;
        }

        const data = fs.readFileSync(rutaMiniPack).toString('base64');

        const media = new MessageMedia(
            'application/zip',
            data,
            'minipack.zip',
            stats.size
        );

        await client.sendMessage(chatId, media, {
            caption: MENSAJES.miniPackCaption,
            sendMediaAsDocument: true,
        });

        guardarEstado(chatId, ESTADOS.PACK_OFRECIDO);

        log.success(`MiniPack enviado correctamente a ${chatId}`);
        return true;

    } catch (error) {
        log.error(`No se pudo enviar el MiniPack: ${error.message}`);
        await client.sendMessage(chatId, MENSAJES.miniPackError);
        return false;
    }
}

// ============================
// 🤖 RESPUESTA CON IA
// ============================
async function generarRespuestaIA(texto) {
    const result = await model.generateContent(texto);
    const response = await result.response;

    const respuesta = normalize(response.text());

    if (!respuesta || respuesta.includes('[SILENCIO]')) {
        return null;
    }

    return respuesta
        .replaceAll('[ENLACE DE HOTMART]', CONFIG.HOTMART_LINK)
        .replaceAll('[ENLACE DEL KIT GRATUITO]', CONFIG.KIT_LINK);
}

// ============================
// 🧭 FLUJO CONVERSACIONAL
// ============================
async function manejarFlujo(userId, texto) {
    const estadoUsuario = obtenerEstado(userId);
    const estado = estadoUsuario.estado;
    const t = limpiarTexto(texto);

    if (contiene(t, ['menu', 'inicio', 'empezar', 'reiniciar', 'ayuda', 'opciones'])) {
        reiniciarEstado(userId);
        guardarEstado(userId, ESTADOS.ESPERANDO_INTENCION);

        return [
            MENSAJES.menu,
            MENSAJES.preguntaIntencion,
        ];
    }

    if (quiereHumano(texto)) {
        guardarEstado(userId, ESTADOS.HUMANO);
        return [MENSAJES.humano];
    }

    if (quierePromotor(texto)) {
        guardarEstado(userId, ESTADOS.PROMOTOR);
        return [MENSAJES.promotor];
    }

    if (quierePack(texto)) {
        guardarEstado(userId, ESTADOS.VENTA_ENVIADA);
        return [
            MENSAJES.presentacionPack,
            MENSAJES.enlaceVenta,
        ];
    }

    if (esPadreConProblema(texto)) {
        guardarEstado(userId, ESTADOS.PACK_OFRECIDO);

        return [
            `Te entiendo 😊 Muchos papás buscan una rutina más tranquila antes de dormir, sobre todo cuando hay pantallas, miedo o inquietud.`,
            `Puedo enviarte un *MiniPack de muestra* para que veas cómo funciona el material. Solo escribe: *minipack*.`,
        ];
    }

    if (estado === ESTADOS.INICIO) {
        if (esSaludo(texto)) {
            guardarEstado(userId, ESTADOS.ESPERANDO_INTENCION);

            return [
                MENSAJES.saludo,
                `Si quieres ver una muestra del producto, escribe: *minipack*.

Si quieres el kit gratuito, dime para quién lo buscas:`,
                MENSAJES.preguntaIntencion,
            ];
        }

        if (quiereKit(texto)) {
            guardarEstado(userId, ESTADOS.ESPERANDO_INTENCION);

            return [
                MENSAJES.saludo,
                MENSAJES.preguntaIntencion,
            ];
        }

        return null;
    }

    if (estado === ESTADOS.ESPERANDO_INTENCION) {
        const intencion = detectarIntencionMaterial(texto);

        if (!intencion) {
            return [
                `Para enviarte el material correcto, responde con una opción:

1️⃣ Para mi hijo/a
2️⃣ Para mis estudiantes
3️⃣ Para mi iglesia o ministerio infantil
4️⃣ Para regalar

También puedes escribir *minipack* si quieres ver una muestra primero.`,
            ];
        }

        guardarEstado(userId, ESTADOS.ESPERANDO_EDAD, { intencion });

        return [MENSAJES.preguntaEdad];
    }

    if (estado === ESTADOS.ESPERANDO_EDAD) {
        const edad = detectarEdad(texto);

        if (!edad) {
            return [
                `Gracias 😊 Solo dime la edad con una opción:

1️⃣ 3 a 5 años
2️⃣ 6 a 8 años
3️⃣ 9 a 12 años`,
            ];
        }

        guardarEstado(userId, ESTADOS.PACK_OFRECIDO, { edad });

        return [
            MENSAJES.entregaKit,
            MENSAJES.pastorScala,
            MENSAJES.presentacionPack,
        ];
    }

    if (estado === ESTADOS.PACK_OFRECIDO) {
        if (esSi(texto) || quierePack(texto)) {
            guardarEstado(userId, ESTADOS.VENTA_ENVIADA);
            return [MENSAJES.enlaceVenta];
        }

        if (esNo(texto)) {
            return [MENSAJES.noInteres];
        }

        return null;
    }

    if (estado === ESTADOS.VENTA_ENVIADA) {
        if (quierePromotor(texto)) {
            guardarEstado(userId, ESTADOS.PROMOTOR);
            return [MENSAJES.promotor];
        }

        if (quiereHumano(texto)) {
            guardarEstado(userId, ESTADOS.HUMANO);
            return [MENSAJES.humano];
        }

        return null;
    }

    return null;
}

// ============================
// 📱 EVENTOS DE WHATSAPP
// ============================
client.on('qr', (qr) => {
    log.info('Escanea el QR con WhatsApp');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    log.success('Sesión autenticada correctamente');
});

client.on('ready', () => {
    log.success('🚀 BOTCUENTOSSCALA ONLINE');

    const rutaMiniPack = obtenerRutaMiniPack();

    if (fs.existsSync(rutaMiniPack)) {
        const stats = fs.statSync(rutaMiniPack);
        log.success(`MiniPack encontrado: ${rutaMiniPack} | Tamaño: ${stats.size} bytes`);
    } else {
        log.warn(`MiniPack NO encontrado en: ${rutaMiniPack}`);
    }
});

client.on('auth_failure', (message) => {
    log.error(`Fallo de autenticación: ${message}`);
});

client.on('disconnected', (reason) => {
    log.warn(`Bot desconectado: ${reason}`);
});

client.on('message', async (msg) => {
    const userId = msg.from;

    try {
        if (userId.includes('@g.us')) return;
        if (userId === 'status@broadcast') return;
        if (msg.fromMe) return;
        if (!msg.body) return;

        const texto = normalize(msg.body);
        if (!texto) return;

        if (procesando.has(userId)) return;

        if (estaEnCooldown(userId)) {
            log.warn(`Cooldown activo para ${userId}`);
            return;
        }

        procesando.add(userId);
        activarCooldown(userId);

        log.info(`Mensaje de ${userId}: ${texto}`);

        if (quiereMiniPack(texto)) {
            await enviarMensajes(userId, [
                MENSAJES.miniPackIntro,
            ]);

            await enviarMiniPack(userId);
            return;
        }

        const respuestasFlujo = await manejarFlujo(userId, texto);

        if (respuestasFlujo && respuestasFlujo.length > 0) {
            await enviarMensajes(userId, respuestasFlujo);
            return;
        }

        let respuestaIA = null;

        try {
            respuestaIA = await generarRespuestaIA(texto);
        } catch (errorIA) {
            log.warn(`Error IA: ${errorIA.message}`);
        }

        if (!respuestaIA) return;

        await enviarMensajes(userId, [respuestaIA]);

    } catch (err) {
        log.error(`Error general: ${err.message}`);
    } finally {
        procesando.delete(userId);
    }
});

// ============================
// 🛡️ ERRORES GLOBALES
// ============================
process.on('unhandledRejection', (reason) => {
    log.error(`Promesa rechazada: ${reason}`);
});

process.on('uncaughtException', (error) => {
    log.error(`Excepción no controlada: ${error.message}`);
});

process.on('SIGINT', async () => {
    log.warn('Cerrando BOTCUENTOSSCALA...');
    await client.destroy();
    process.exit(0);
});

// ============================
// 🚀 INICIO
// ============================
client.initialize();