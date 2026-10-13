/**
 * ============================================================================
 * Lost & Found Portal - Main Application Logic
 * AWS Services: Amazon Cognito, Amazon API Gateway, Amazon S3, Amazon DynamoDB, Amazon SNS, Amazon Bedrock (Nova Lite)
 * ============================================================================
 */

// ============================================================================
// 1. CONFIGURACIÓN AWS / API GATEWAY & COGNITO
// ============================================================================
const AWS_REGION = 'us-east-1';
const USER_POOL_ID = 'us-east-1_Www1X2mBC';
const CLIENT_ID = '65f9o7e1mst13csirabv4c2kd9';

const API_BASE_URL = 'https://zhylygp2y7.execute-api.us-east-1.amazonaws.com/dev';
const ITEMS_URL = `${API_BASE_URL}/items`;
const MATCHES_URL = `${API_BASE_URL}/matches`;
const CHAT_URL = `${API_BASE_URL}/chat`;

const poolData = {
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// ============================================================================
// 2. ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================
window.activeSession = null;
window.currentUserIsStaff = false;
window.currentUserIsGerencia = false;
window.currentUserData = null;
window.currentItems = [];
window.currentMatches = [];
window.currentFilter = 'ALL'; // ALL | PENDING | VALIDATED | DELIVERED

// ============================================================================
// 3. IMÁGENES ESPECÍFICAS POR CATEGORÍA
// ============================================================================
const CATEGORY_IMAGES = {
    wallet: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
    smartphone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
    backpack: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80',
    jewelry: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80',
    clothing: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
    laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
    keys: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80',
    other: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80'
};

function getCategoryPlaceholderImage(category) {
    const cat = String(category || '').toLowerCase();
    if (cat.includes('billetera') || cat.includes('wallet') || cat.includes('document')) {
        return CATEGORY_IMAGES.wallet;
    }
    if (cat.includes('smart') || cat.includes('celular') || cat.includes('phone') || cat.includes('tablet')) {
        return CATEGORY_IMAGES.smartphone;
    }
    if (cat.includes('mochila') || cat.includes('bolso') || cat.includes('bag') || cat.includes('backpack')) {
        return CATEGORY_IMAGES.backpack;
    }
    if (cat.includes('joya') || cat.includes('reloj') || cat.includes('watch') || cat.includes('jewelry')) {
        return CATEGORY_IMAGES.jewelry;
    }
    if (cat.includes('prenda') || cat.includes('ropa') || cat.includes('clothing') || cat.includes('polo') || cat.includes('casaca')) {
        return CATEGORY_IMAGES.clothing;
    }
    if (cat.includes('laptop') || cat.includes('comput') || cat.includes('tech') || cat.includes('electronic')) {
        return CATEGORY_IMAGES.laptop;
    }
    if (cat.includes('llave') || cat.includes('key')) {
        return CATEGORY_IMAGES.keys;
    }
    return CATEGORY_IMAGES.other;
}

// ============================================================================
// 4. CONTROLADOR DE TEMA (CLARO / OSCURO)
// ============================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
}

function applyTheme(theme) {
    const body = document.body;
    const docEl = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');

    if (theme === 'dark') {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme', 'dark');
        docEl.classList.add('dark');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'sun');
        }
        if (themeText) {
            themeText.textContent = 'Modo Claro';
        }
    } else {
        body.classList.remove('dark-theme', 'dark');
        body.classList.add('light-theme');
        docEl.classList.remove('dark');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'moon');
        }
        if (themeText) {
            themeText.textContent = 'Modo Oscuro';
        }
    }
    localStorage.setItem('theme', theme);
    if (window.lucide) {
        lucide.createIcons();
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// ============================================================================
// 5. UTILIDADES & SANITIZACIÓN
// ============================================================================
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function normalizeGroups(groups) {
    return (groups || []).map(group => String(group).trim().toUpperCase());
}

function formatDate(value) {
    if (!value) return 'Fecha no indicada';
    try {
        const date = new Date(String(value).includes('T') ? value : `${value}T00:00:00`);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return String(value);
    }
}

function getStatusInfo(status) {
    const value = String(status || 'REGISTERED').toUpperCase();
    if (['VALIDATED', 'CONFIRMED', 'MATCHED', 'APROBADO', 'VALIDADO'].includes(value)) {
        return {
            label: 'Propiedad validada',
            css: 'bg-blue-500/15 text-blue-500 border-blue-500/30 font-semibold'
        };
    }
    if (['DELIVERED', 'ENTREGADO', 'CLOSED', 'COMPLETED', 'RESUELTO'].includes(value)) {
        return {
            label: 'Entregado',
            css: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-semibold'
        };
    }
    return {
        label: 'Registrado / Pendiente',
        css: 'bg-amber-500/10 text-amber-500 border-amber-500/30'
    };
}

function extractArrayFromResponse(result, defaultKey) {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (Array.isArray(result[defaultKey])) return result[defaultKey];
    if (Array.isArray(result[defaultKey.toLowerCase()])) return result[defaultKey.toLowerCase()];
    if (Array.isArray(result[defaultKey.charAt(0).toUpperCase() + defaultKey.slice(1)])) return result[defaultKey.charAt(0).toUpperCase() + defaultKey.slice(1)];
    if (Array.isArray(result.Items)) return result.Items;
    if (Array.isArray(result.items)) return result.items;
    if (Array.isArray(result.Matches)) return result.Matches;
    if (Array.isArray(result.matches)) return result.matches;
    if (Array.isArray(result.data)) return result.data;
    if (typeof result.body === 'string') {
        try {
            const parsed = JSON.parse(result.body);
            return extractArrayFromResponse(parsed, defaultKey);
        } catch (e) {
            return [];
        }
    }
    if (typeof result.body === 'object' && result.body !== null) {
        return extractArrayFromResponse(result.body, defaultKey);
    }
    return [];
}

function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') return {};
    return {
        ...raw,
        itemID: raw.itemID || raw.itemId || raw.id || raw.ID || raw.SK || raw.PK || '',
        pickupCode: raw.pickupCode || raw.PickupCode || '', // <--- ¡LÍNEA NUEVA!
        type: String(raw.type || raw.Type || raw.itemType || 'LOST').toUpperCase(),
        title: raw.title || raw.Title || raw.name || raw.Name || 'Sin título',
        category: raw.category || raw.Category || 'General',
        zone: raw.zone || raw.Zone || raw.location || raw.Location || 'Zona no indicada',
        date: raw.date || raw.Date || raw.eventDate || raw.EventDate || (raw.createdAt ? String(raw.createdAt).slice(0, 10) : ''),
        description: raw.description || raw.Description || 'Sin descripción',
        status: String(raw.status || raw.Status || 'REGISTERED').toUpperCase(),
        imageUrl: raw.imageUrl || raw.ImageUrl || raw.photoUrl || raw.photo || raw.image || raw.s3Url || '',
        createdAt: raw.createdAt || raw.CreatedAt || raw.timestamp || Date.now(),
        createdBy: raw.reportedByEmail || raw.reportedBy || raw.createdBy || raw.CreatedBy || raw.userId || raw.userEmail || raw.email || raw.sub || ''
    };
}

function normalizeMatch(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const lostId = raw.lostItemID || raw.lostItemId || raw.lostId || raw.lost_item_id || (raw.lostItem && (raw.lostItem.itemID || raw.lostItem.itemId)) || '';
    const foundId = raw.foundItemID || raw.foundItemId || raw.foundId || raw.found_item_id || (raw.foundItem && (raw.foundItem.itemID || raw.foundItem.itemId)) || '';
    
    return {
        ...raw,
        matchID: raw.matchID || raw.matchId || raw.id || raw.ID || '',
        lostItemID: lostId,
        foundItemID: foundId,
        matchScore: Number(raw.matchScore ?? raw.score ?? raw.similarity ?? 0),
        status: String(raw.status || raw.Status || 'POSSIBLE').toUpperCase(),
        visualStatus: String(raw.visualStatus || raw.visual_status || raw.VisualStatus || '').toUpperCase(),
        visualSimilarity: raw.visualSimilarity || raw.visual_similarity || raw.VisualSimilarity || '',
        visualAnalysis: raw.visualAnalysis || raw.visual_analysis || raw.explanation || raw.VisualAnalysis || '',
        matchedCriteria: Array.isArray(raw.matchedCriteria) ? raw.matchedCriteria : (Array.isArray(raw.criteria) ? raw.criteria : []),
        lostItem: raw.lostItem ? normalizeItem(raw.lostItem) : null,
        foundItem: raw.foundItem ? normalizeItem(raw.foundItem) : null
    };
}

// ============================================================================
// 5.1. TRADUCCIÓN DE ERRORES DE COGNITO A ESPAÑOL
// ============================================================================
function translateCognitoError(err) {
    if (!err) return 'Ocurrió un error inesperado.';
    const msg = String(err.message || err.code || err);

    if (msg.includes('Password did not conform with policy') || msg.includes('InvalidPasswordException')) {
        if (msg.includes('Password not long enough') || msg.includes('longer than')) {
            return 'La contraseña debe tener al menos 8 caracteres.';
        }
        if (msg.includes('uppercase')) {
            return 'La contraseña debe contener al menos una letra mayúscula.';
        }
        if (msg.includes('lowercase')) {
            return 'La contraseña debe contener al menos una letra minúscula.';
        }
        if (msg.includes('numeric')) {
            return 'La contraseña debe contener al menos un número.';
        }
        if (msg.includes('symbol')) {
            return 'La contraseña debe contener al menos un carácter especial (ej. !@#$%^&*).';
        }
        return 'La contraseña debe tener mín. 8 caracteres, al menos 1 letra mayúscula, 1 número y 1 símbolo especial (!@#$%).';
    }

    if (err.code === 'UsernameExistsException' || msg.includes('already exists') || msg.includes('User already exists')) {
        return 'Este correo electrónico ya está registrado. Por favor inicia sesión.';
    }
    if (err.code === 'UserNotConfirmedException' || msg.includes('User is not confirmed')) {
        return 'Tu cuenta aún no está activada. Ingresa el código de 6 dígitos que enviamos a tu correo.';
    }
    if (err.code === 'NotAuthorizedException' || msg.includes('Incorrect username or password')) {
        return 'Correo o contraseña incorrectos. Por favor verifica tus credenciales.';
    }
    if (err.code === 'UserNotFoundException' || msg.includes('User does not exist')) {
        return 'No existe ninguna cuenta registrada con este correo.';
    }
    if (err.code === 'CodeMismatchException' || msg.includes('Invalid verification code')) {
        return 'Código de verificación incorrecto. Revisa el código de 6 dígitos en tu bandeja.';
    }
    if (err.code === 'ExpiredCodeException' || msg.includes('expired')) {
        return 'El código de verificación ha expirado. Presiona "Reenviar código".';
    }
    if (err.code === 'LimitExceededException' || msg.includes('Attempt limit exceeded')) {
        return 'Has superado el límite de intentos permitidos. Espera unos minutos.';
    }
    if (err.code === 'InvalidParameterException') {
        return 'Por favor verifica que todos los campos cumplan el formato solicitado.';
    }

    return err.message || 'Error al procesar la solicitud con AWS.';
}
function getToken() {
    if (!window.activeSession) {
        throw new Error('No hay una sesión activa de AWS Cognito.');
    }
    return window.activeSession.getIdToken().getJwtToken();
}

async function apiFetch(url, options = {}) {
    const token = getToken();
    const separator = url.includes('?') ? '&' : '?';

    const response = await fetch(`${url}${separator}t=${Date.now()}`, {
        ...options,
        cache: 'no-store',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            'Authorization': token,
            ...(options.headers || {})
        }
    });

    const responseText = await response.text();
    let result = {};

    if (responseText) {
        try {
            result = JSON.parse(responseText);
        } catch {
            console.error('Respuesta no JSON:', responseText);
            throw new Error('La API devolvió una respuesta no válida.');
        }
    }

    if (!response.ok) {
        throw new Error(result.message || `Error HTTP ${response.status}`);
    }

    return result;
}

// ============================================================================
// 7. HELPER DE COINCIDENCIAS (MATCHES)
// ============================================================================
function matchesForItem(itemID) {
    return window.currentMatches.filter(
        match => match.lostItemID === itemID || match.foundItemID === itemID
    );
}

function possibleMatchesForItem(itemID) {
    return matchesForItem(itemID).filter(
        match => String(match.status || '').toUpperCase() === 'POSSIBLE'
    );
}

function validatedMatchForItem(itemID) {
    return matchesForItem(itemID).find(
        match => String(match.status || '').toUpperCase() === 'VALIDATED'
    );
}

// ============================================================================
// 8. RENDERIZADO DE EVIDENCIA FOTOGRÁFICA Y ANÁLISIS AMAZON BEDROCK (NOVA LITE)
// ============================================================================
function safePhotoUrl(url) {
    if (typeof url !== 'string') return '';
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' ? parsed.href : '';
    } catch { return ''; }
}

function photoTile(item, label, compact = false) {
    const photo = safePhotoUrl(item?.imageUrl);
    const title = escapeHtml(item?.title || label);
    if (!photo) {
        return `
            <div class="lf-photo-tile lf-photo-empty ${compact ? 'lf-photo-small' : ''}">
                <span class="lf-empty-icon">📷</span>
                <span class="font-semibold text-xs">${escapeHtml(label)}</span>
                <small class="text-[10px] theme-text-muted">Sin foto adjunta</small>
            </div>
        `;
    }
    return `
        <button 
            type="button" 
            class="lf-photo-tile lf-photo-trigger ${compact ? 'lf-photo-small' : ''}" 
            data-photo-url="${escapeHtml(photo)}" 
            data-photo-title="${title}" 
            aria-label="Ampliar fotografía de ${title}" 
            title="Ver fotografía en alta resolución"
        >
            <img src="${escapeHtml(photo)}" alt="Fotografía real de ${title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('lf-photo-failed'); this.style.display='none'">
            <span class="lf-photo-label">${escapeHtml(label)} · Ampliar ↗</span>
            <span class="lf-photo-error">No se pudo cargar la imagen.</span>
        </button>
    `;
}

function novaAnalysisHtml(match) {
    const state = String(match.visualStatus || '').toUpperCase();
    if (!state) {
        return `
            <div class="lf-ai-info">
                Análisis visual de Amazon Bedrock pendiente o no disponible.
            </div>
        `;
    }
    if (state === 'PENDING') {
        return `
            <div class="lf-ai-card lf-ai-pending">
                <div class="lf-ai-heading">
                    <span class="lf-ai-spinner"></span> Amazon Nova Lite · Analizando fotografías
                </div>
                <p class="text-xs theme-text-muted mt-1">Comparando características visuales en AWS Bedrock...</p>
            </div>
        `;
    }
    if (state === 'NOT_AVAILABLE') {
        return `
            <div class="lf-ai-info">
                Comparación visual de Bedrock no disponible: se requiere foto en ambos reportes.
            </div>
        `;
    }
    if (state === 'ERROR') {
        return `
            <div class="lf-ai-card lf-ai-error">
                <div class="lf-ai-heading">⚠️ Amazon Nova Lite · No disponible</div>
                <p class="text-xs theme-text-muted mt-1">El score heurístico y los botones de validación siguen operativos.</p>
            </div>
        `;
    }
    if (state === 'COMPLETED') {
        const similarity = String(match.visualSimilarity || 'NO_DETERMINADA').toUpperCase();
        const className = ['ALTA', 'MEDIA', 'BAJA'].includes(similarity) ? similarity.toLowerCase() : 'unknown';
        return `
            <div class="lf-ai-card">
                <div class="lf-ai-heading">
                    <span>✨ Análisis Visual · Amazon Nova Lite</span>
                    <span class="lf-ai-badge lf-ai-${className}">${escapeHtml(similarity.replace('_',' '))}</span>
                </div>
                <div class="lf-ai-body">${escapeHtml(match.visualAnalysis || 'Sin detalles disponibles.')}</div>
                <div class="lf-ai-disclaimer">Evaluación asistida por IA generativa (Bedrock Nova Lite). La validación final corresponde a Seguridad.</div>
            </div>
        `;
    }
    return '';
}

function closePhotoViewer() {
    const modal = document.getElementById('lfPhotoViewer');
    if (modal) {
        modal.hidden = true;
        document.body.classList.remove('lf-modal-open');
    }
}

function openPhotoViewer(url, title) {
    const safe = safePhotoUrl(url);
    if (!safe) return;
    const modal = document.getElementById('lfPhotoViewer');
    if (!modal) return;
    const image = modal.querySelector('#lfPhotoViewerImage');
    if (image) {
        image.src = safe;
        image.alt = title || 'Fotografía del objeto';
    }
    const titleEl = modal.querySelector('#lfPhotoViewerTitle');
    if (titleEl) titleEl.textContent = title || 'Fotografía del objeto';
    modal.hidden = false;
    document.body.classList.add('lf-modal-open');
    modal.querySelector('.lf-photo-close')?.focus();
}

// ============================================================================
// 9. RENDERIZADO DE INTERFAZ DEL CLIENTE
// ============================================================================
function buildCustomerMatchHtml(item) {
    const validated = validatedMatchForItem(item.itemID);

    if (validated || String(item.status || '').toUpperCase() === 'VALIDATED') {
        return `
            <div class="mt-3.5 p-3.5 rounded-2xl border border-blue-500/30 bg-blue-500/5 theme-card">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
                        ✓ Propiedad validada
                    </p>
                    <button 
                        type="button"
                        onclick="showPickupModal('${escapeHtml(item.itemID)}', '${escapeHtml(item.title)}', '${escapeHtml(item.pickupCode)}')"
                        class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full shadow-md shadow-blue-500/20 transition-all shrink-0 cursor-pointer"
                    >
                        Ver código de retiro
                    </button>
                </div>
                <p class="text-xs theme-text-secondary mt-1">
                    Seguridad confirmó la coincidencia de este reporte.
                </p>
            </div>
        `;
    }

    const matches = possibleMatchesForItem(item.itemID);

    if (matches.length === 0) {
        return `
            <div class="mt-3.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                <p class="text-xs theme-text-muted text-center">
                    Sin coincidencias detectadas por el momento.
                </p>
            </div>
        `;
    }

    // Verificación si IA está analizando
    const isPending = matches.some(m => String(m.visualStatus || '').toUpperCase() === 'PENDING');
    if (isPending) {
        return `
            <div class="mt-3.5 p-3.5 rounded-2xl border border-sky-500/30 bg-sky-500/5">
                <p class="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-2">
                    <span class="lf-ai-spinner"></span> Analizando similitud con Amazon Nova Lite...
                </p>
            </div>
        `;
    }

    const bestScore = Math.max(...matches.map(m => Number(m.matchScore || 0)));

    return `
        <div class="mt-3.5 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
            <div class="flex items-center justify-between gap-3">
                <p class="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                    🔗 Posible coincidencia encontrada
                </p>
                <span class="text-sm font-extrabold text-amber-600 dark:text-amber-300">
                    ${bestScore}%
                </span>
            </div>
            <p class="text-xs theme-text-secondary mt-1">
                Pendiente de validación por Seguridad.
            </p>
        </div>
    `;
}

function buildItemCard(item) {
    const isFound = String(item.type || '').toUpperCase() === 'FOUND';
    const status = getStatusInfo(item.status);
    let matchSection = '';

    if (!window.currentUserIsStaff) {
        matchSection = buildCustomerMatchHtml(item);
    } else {
        const possible = possibleMatchesForItem(item.itemID);
        const validated = validatedMatchForItem(item.itemID);

        if (validated) {
            matchSection = `
                <div class="mt-3.5 p-3 rounded-2xl border border-blue-500/30 bg-blue-500/5">
                    <p class="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        ✓ Coincidencia validada
                    </p>
                </div>
            `;
        } else if (possible.length > 0) {
            const best = Math.max(...possible.map(m => Number(m.matchScore || 0)));
            matchSection = `
                <div class="mt-3.5 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/5">
                    <p class="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ${possible.length} posible(s) coincidencia(s) (${best}% max)
                    </p>
                </div>
            `;
        } else {
            matchSection = `
                <div class="mt-3.5 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                    <p class="text-xs theme-text-muted text-center">Sin coincidencias detectadas.</p>
                </div>
            `;
        }
    }

    // Cabecera con Fotografía Real de S3 o Tile descriptivo
    const headerHtml = `<div class="lf-item-photo-wrap">${photoTile(item, isFound ? 'Objeto Encontrado' : 'Objeto Perdido')}</div>`;

    return `
        <article class="theme-card border rounded-3xl overflow-hidden shadow-md flex flex-col justify-between hover:shadow-xl transition-all">
            <div>
                ${headerHtml}

                <div class="p-5">
                    <div class="flex justify-between items-start gap-3">
                        <div>
                            <h3 class="font-extrabold text-base theme-text-primary">
                                ${escapeHtml(item.title || 'Sin título')}
                            </h3>
                            <p class="text-xs theme-text-muted mt-0.5">
                                ${escapeHtml(item.category || 'General')}
                            </p>
                        </div>
                        <span class="border text-[11px] px-2.5 py-0.5 rounded-full whitespace-nowrap ${status.css}">
                            ${status.label}
                        </span>
                    </div>

                    <p class="text-xs theme-text-secondary mt-3 leading-relaxed">
                        ${escapeHtml(item.description || 'Sin descripción')}
                    </p>

                    ${matchSection}
                </div>
            </div>

            <div class="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs theme-text-muted space-y-1">
                <div class="flex items-center gap-1.5">
                    <span>📍</span>
                    <span class="font-medium">${escapeHtml(item.zone || 'Zona no indicada')}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span>📅</span>
                    <span>${escapeHtml(formatDate(item.date))}</span>
                </div>
                ${
                    window.currentUserIsStaff
                        ? `<div class="pt-1 text-[10px] text-slate-400 font-mono">ID: ${escapeHtml(item.itemID)}</div>`
                        : ''
                }
            </div>
        </article>
    `;
}

function renderItems() {
    const itemsGrid = document.getElementById('itemsGrid');
    if (!itemsGrid) return;

    let items = [...window.currentItems];

    // En vista de visitante (cliente), mostrar sus reportes o reportes de tipo LOST
    if (!window.currentUserIsStaff) {
        const userEmail = (window.currentUserData?.email || '').toLowerCase();
        const userSub = window.currentUserData?.sub || '';

        const userSpecificItems = items.filter(i => {
            const itemCreator = String(i.createdBy || '').toLowerCase();
            return (userEmail && itemCreator === userEmail) || (userSub && itemCreator === userSub);
        });

        items = userSpecificItems;
    }

    // Aplicar Filtros con soporte para múltiples variantes de estado
    if (window.currentFilter === 'PENDING') {
        items = items.filter(i => ['REGISTERED', 'PENDING', 'OPEN', 'ACTIVO', 'REPORTED', 'NUEVO'].includes(String(i.status || '').toUpperCase()));
    } else if (window.currentFilter === 'VALIDATED') {
        items = items.filter(i => ['VALIDATED', 'CONFIRMED', 'MATCHED', 'APROBADO', 'VALIDADO'].includes(String(i.status || '').toUpperCase()));
    } else if (window.currentFilter === 'DELIVERED') {
        items = items.filter(i => ['DELIVERED', 'ENTREGADO', 'CLOSED', 'COMPLETED', 'RESUELTO'].includes(String(i.status || '').toUpperCase()));
    }

    if (items.length === 0) {
        itemsGrid.innerHTML = `
            <div class="col-span-full theme-card border rounded-3xl p-10 text-center">
                <p class="text-sm theme-text-muted">No hay reportes para este filtro.</p>
            </div>
        `;
        return;
    }

    items.sort((a, b) => {
        const aMatches = possibleMatchesForItem(a.itemID).length;
        const bMatches = possibleMatchesForItem(b.itemID).length;
        if (aMatches !== bMatches) return bMatches - aMatches;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    itemsGrid.innerHTML = items.map(buildItemCard).join('');
    if (window.lucide) lucide.createIcons();
}

// ============================================================================
// 10. RENDERIZADO DE COINCIDENCIAS (STAFF / SEGURIDAD)
// ============================================================================
function buildMatchCandidate(match) {
    const lost = match.lostItem || {};
    const score = Number(match.matchScore || 0);
    const status = String(match.status || 'POSSIBLE').toUpperCase();
    const isValidated = status === 'VALIDATED';
    const isRejected = status === 'REJECTED';

    let actionHtml = '';
    if (isValidated) {
        actionHtml = `
            <div class="mt-4 px-3.5 py-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                ✓ Coincidencia validada & Notificación enviada
            </div>
        `;
    } else if (isRejected) {
        actionHtml = `
            <div class="mt-4 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 theme-text-muted text-xs">
                Coincidencia descartada
            </div>
        `;
    } else {
        actionHtml = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <button
                    type="button"
                    class="validateMatchBtn bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-2xl transition-all text-xs shadow-sm cursor-pointer"
                    data-match-id="${escapeHtml(match.matchID)}"
                >
                    ✓ Validar
                </button>
                <button
                    type="button"
                    class="rejectMatchBtn bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-semibold py-2.5 rounded-2xl transition-all text-xs cursor-pointer"
                    data-match-id="${escapeHtml(match.matchID)}"
                >
                    ✕ Descartar
                </button>
            </div>
        `;
    }

    return `
        <div class="rounded-2xl border p-4 theme-card ${
            isValidated ? 'border-blue-500/40 bg-blue-500/5' : isRejected ? 'opacity-60' : ''
        }">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h4 class="font-bold text-sm theme-text-primary">
                        🔎 ${escapeHtml(lost.title || 'Objeto reportado como perdido')}
                    </h4>
                    <p class="text-xs theme-text-secondary mt-1.5 leading-relaxed">
                        ${escapeHtml(lost.description || 'Sin descripción')}
                    </p>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-xl font-extrabold ${
                        score >= 90 ? 'text-emerald-500' : score >= 75 ? 'text-amber-500' : 'text-blue-500'
                    }">
                        ${score}%
                    </div>
                    <span class="text-[10px] theme-text-muted">criterios</span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3 text-xs theme-text-muted">
                <div>📍 ${escapeHtml(lost.zone || 'Sin zona')}</div>
                <div>📅 ${escapeHtml(formatDate(lost.date))}</div>
            </div>

            ${
                Array.isArray(match.matchedCriteria) && match.matchedCriteria.length > 0
                    ? `<div class="mt-3 flex flex-wrap gap-1.5">
                         ${match.matchedCriteria
                             .map(
                                 c => `<span class="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full font-medium">${escapeHtml(c)}</span>`
                             )
                             .join('')}
                       </div>`
                    : ''
            }

            <!-- Comparación Visual de Ambas Fotos -->
            <div class="lf-compare-grid">
                ${photoTile(lost, 'Objeto perdido', true)}
                ${photoTile(match.foundItem || {}, 'Objeto encontrado', true)}
            </div>

            <!-- Análisis con Amazon Bedrock Nova Lite -->
            ${novaAnalysisHtml(match)}

            ${actionHtml}
        </div>
    `;
}

function renderStaffMatches() {
    const matchesGrid = document.getElementById('matchesGrid');
    if (!matchesGrid) return;

    const matches = [...window.currentMatches];
    const possibleCount = matches.filter(
        m => String(m.status || '').toUpperCase() === 'POSSIBLE'
    ).length;

    const badge = document.getElementById('matchCountBadge');
    if (badge) badge.textContent = possibleCount;

    if (matches.length === 0) {
        matchesGrid.innerHTML = `
            <div class="theme-card border rounded-3xl p-10 text-center">
                <p class="text-sm theme-text-muted">No hay coincidencias registradas por el momento.</p>
            </div>
        `;
        return;
    }

    const groups = {};
    matches.forEach(match => {
        const foundID = match.foundItemID || 'unknown';
        if (!groups[foundID]) {
            groups[foundID] = {
                foundItem: match.foundItem || {},
                matches: []
            };
        }
        groups[foundID].matches.push(match);
    });

    const groupArray = Object.values(groups);
    groupArray.sort((a, b) => {
        const aBest = Math.max(...a.matches.map(m => Number(m.matchScore || 0)));
        const bBest = Math.max(...b.matches.map(m => Number(m.matchScore || 0)));
        return bBest - aBest;
    });

    matchesGrid.innerHTML = groupArray
        .map(group => {
            const found = group.foundItem || {};
            const candidates = [...group.matches].sort(
                (a, b) => Number(b.matchScore || 0) - Number(a.matchScore || 0)
            );

            return `
                <section class="theme-card border rounded-3xl overflow-hidden shadow-md mb-6">
                    <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-emerald-500/5">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    📦 Objeto Encontrado por Seguridad
                                </span>
                                <h3 class="text-lg font-bold theme-text-primary mt-1">
                                    ${escapeHtml(found.title || 'Objeto encontrado')}
                                </h3>
                                <p class="text-xs theme-text-secondary mt-1.5">
                                    ${escapeHtml(found.description || 'Sin descripción')}
                                </p>
                            </div>
                            <span class="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                                ${candidates.length} candidato(s)
                            </span>
                        </div>
                        <div class="lf-found-photo">${photoTile(found, 'Fotografía del hallazgo')}</div>
                        <div class="flex flex-wrap gap-4 mt-3 text-xs theme-text-muted">
                            <span>📍 ${escapeHtml(found.zone || 'Sin zona')}</span>
                            <span>📅 ${escapeHtml(formatDate(found.date))}</span>
                        </div>
                    </div>

                    <div class="p-6">
                        <p class="text-xs font-semibold uppercase tracking-wider theme-text-muted mb-4">
                            Posibles reportes de pérdida relacionados:
                        </p>
                        <div class="space-y-3">
                            ${candidates.map(buildMatchCandidate).join('')}
                        </div>
                    </div>
                </section>
            `;
        })
        .join('');

    if (window.lucide) lucide.createIcons();
}

// ============================================================================
// 11. CARGA DE DATOS DESDE DYNAMODB / API GATEWAY
// ============================================================================
async function loadData() {
    const itemsGrid = document.getElementById('itemsGrid');
    if (itemsGrid) {
        itemsGrid.innerHTML = `
            <div class="col-span-full py-12 text-center text-sm theme-text-muted">
                <span class="inline-block animate-spin mr-2">⏳</span> Sincronizando con AWS...
            </div>
        `;
    }

    try {
        const itemsResult = await apiFetch(ITEMS_URL, { method: 'GET' });
        const rawItems = extractArrayFromResponse(itemsResult, 'items');
        window.currentItems = rawItems.map(normalizeItem);
        window.lastSyncAt = Date.now();

        try {
            const matchesResult = await apiFetch(MATCHES_URL, { method: 'GET' });
            const rawMatches = extractArrayFromResponse(matchesResult, 'matches');
            window.currentMatches = rawMatches.map(m => {
                const normalized = normalizeMatch(m);
                // Si lostItem o foundItem no vinieron completos, hidratar desde currentItems
                if (!normalized.lostItem && normalized.lostItemID) {
                    normalized.lostItem = window.currentItems.find(i => i.itemID === normalized.lostItemID) || {};
                }
                if (!normalized.foundItem && normalized.foundItemID) {
                    normalized.foundItem = window.currentItems.find(i => i.itemID === normalized.foundItemID) || {};
                }
                return normalized;
            });
        } catch (matchErr) {
            console.warn('Coincidencias no disponibles o sin permisos de matching:', matchErr);
            window.currentMatches = [];
        }

        renderItems();
        if (window.currentUserIsStaff) {
            renderStaffMatches();
        }
        if (window.currentUserIsGerencia || !document.getElementById('gerenciaView')?.classList.contains('hidden')) {
            renderGerenciaDashboard();
        }
    } catch (error) {
        console.error('Error cargando datos de DynamoDB:', error);
        if (itemsGrid) {
            itemsGrid.innerHTML = `
                <div class="col-span-full theme-card border rounded-3xl p-8 text-center text-red-500 text-sm">
                    Error al conectar con la base de datos: ${escapeHtml(error.message)}
                </div>
            `;
        }
        const hotspotsContainer = document.getElementById('hotspotsContainer');
        if (hotspotsContainer && window.currentItems.length === 0) {
            hotspotsContainer.innerHTML = `
                <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                    ⚠️ <strong>Aviso de conexión:</strong> No se pudieron recuperar los reportes de AWS DynamoDB (${escapeHtml(error.message)}). Verifica tu conexión o permisos de usuario.
                </div>
            `;
        }
    }
}

// ============================================================================
// 11.5. MÓDULO DE GERENCIA & ANALÍTICA (KPIS, PUNTOS CALIENTES & DONACIONES)
// ============================================================================
window.gerenciaDonationLot = [];

function activateItemsTab() {
    const tabItems = document.getElementById('tabItems');
    const tabMatches = document.getElementById('tabMatches');
    const tabGerencia = document.getElementById('tabGerencia');
    const itemsView = document.getElementById('itemsView');
    const matchesView = document.getElementById('matchesView');
    const gerenciaView = document.getElementById('gerenciaView');
    const formColumn = document.getElementById('formColumn');
    const contentColumn = document.getElementById('contentColumn');
    const itemsSectionHeader = document.getElementById('itemsSectionHeader');

    formColumn?.classList.remove('hidden');
    if (contentColumn) {
        contentColumn.className = 'lg:col-span-7 transition-all duration-300';
    }

    itemsSectionHeader?.classList.remove('hidden');
    itemsView?.classList.remove('hidden');
    matchesView?.classList.add('hidden');
    gerenciaView?.classList.add('hidden');

    const staffSearchSection = document.getElementById('staffSearchSection');
    if (staffSearchSection) {
        if (window.currentUserIsStaff) {
            staffSearchSection.classList.remove('hidden');
        } else {
            staffSearchSection.classList.add('hidden');
        }
    }

    if (tabItems) tabItems.className = 'px-4 py-2 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm transition-all cursor-pointer';
    if (tabMatches) tabMatches.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary transition-all flex items-center gap-1.5 cursor-pointer';
    if (tabGerencia) tabGerencia.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary transition-all flex items-center gap-1.5 cursor-pointer';
}

function activateMatchesTab() {
    const tabItems = document.getElementById('tabItems');
    const tabMatches = document.getElementById('tabMatches');
    const tabGerencia = document.getElementById('tabGerencia');
    const itemsView = document.getElementById('itemsView');
    const matchesView = document.getElementById('matchesView');
    const gerenciaView = document.getElementById('gerenciaView');
    const formColumn = document.getElementById('formColumn');
    const contentColumn = document.getElementById('contentColumn');
    const itemsSectionHeader = document.getElementById('itemsSectionHeader');

    formColumn?.classList.remove('hidden');
    if (contentColumn) {
        contentColumn.className = 'lg:col-span-7 transition-all duration-300';
    }

    itemsSectionHeader?.classList.add('hidden');
    itemsView?.classList.add('hidden');
    matchesView?.classList.remove('hidden');
    gerenciaView?.classList.add('hidden');
    document.getElementById('staffSearchSection')?.classList.add('hidden');

    if (tabItems) tabItems.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary transition-all cursor-pointer';
    if (tabMatches) tabMatches.className = 'px-4 py-2 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer';
    if (tabGerencia) tabGerencia.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary transition-all flex items-center gap-1.5 cursor-pointer';

    renderStaffMatches();
}

function activateGerenciaTab() {
    const tabItems = document.getElementById('tabItems');
    const tabMatches = document.getElementById('tabMatches');
    const tabGerencia = document.getElementById('tabGerencia');
    const itemsView = document.getElementById('itemsView');
    const matchesView = document.getElementById('matchesView');
    const gerenciaView = document.getElementById('gerenciaView');
    const formColumn = document.getElementById('formColumn');
    const contentColumn = document.getElementById('contentColumn');
    const itemsSectionHeader = document.getElementById('itemsSectionHeader');

    // Modo ejecutivo full-width
    formColumn?.classList.add('hidden');
    if (contentColumn) {
        contentColumn.className = 'lg:col-span-12 transition-all duration-300';
    }

    itemsSectionHeader?.classList.add('hidden');
    itemsView?.classList.add('hidden');
    matchesView?.classList.add('hidden');
    gerenciaView?.classList.remove('hidden');
    document.getElementById('staffSearchSection')?.classList.add('hidden');

    if (tabItems) tabItems.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary transition-all cursor-pointer';
    if (tabMatches) tabMatches.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary transition-all flex items-center gap-1.5 cursor-pointer';
    if (tabGerencia) tabGerencia.className = 'px-4 py-2 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer';

    renderGerenciaDashboard();
}

// ----------------------------------------------------------------------------
// Constantes y utilidades del módulo
// ----------------------------------------------------------------------------
const GER_DAY_MS = 24 * 60 * 60 * 1000;
const GER_DONATION_DAYS = 30;
const GER_LEGAL_DAYS = 90;
const GER_WARNING_DAYS = 20;
const GER_DELIVERED_STATES = ['DELIVERED', 'ENTREGADO', 'CLAIMED', 'CLOSED', 'COMPLETED', 'RESUELTO'];
const GER_VALIDATED_STATES = ['VALIDATED', 'CONFIRMED', 'MATCHED', 'APROBADO', 'VALIDADO'];
const GER_SLOTS = {
    morning:   { label: 'Mañana', range: '10:00 – 13:00', icon: '☀️' },
    afternoon: { label: 'Tarde',  range: '13:00 – 18:00', icon: '🌤️' },
    night:     { label: 'Noche',  range: '18:00 – 22:00', icon: '🌙' }
};
const GER_SLOT_KEYS = ['morning', 'afternoon', 'night'];
const GER_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

window.gerenciaDonationLot = [];
window.gerenciaDonationFilter = 'ALL';   // ALL | D30 (30-89 d) | D90 (>= 90 d)
window.gerenciaSelectedIds = new Set();
window.gerenciaInsightsText = '';

function gerSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function gerSetHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function gerMoney(n) {
    return `S/ ${Math.round(Number(n) || 0).toLocaleString('es-PE')}`;
}

function gerN(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
}

function gerPct(n, d) {
    return d > 0 ? Math.round((n / d) * 100) : 0;
}

// Acepta puntajes 0-1 o 0-100 y los devuelve siempre en escala 0-100
function gerNormScore(v) {
    const n = Number(v) || 0;
    return n > 0 && n <= 1 ? n * 100 : n;
}

function gerIsDelivered(item) {
    return GER_DELIVERED_STATES.includes(String(item?.status || '').toUpperCase());
}

function gerIsValidated(item) {
    return GER_VALIDATED_STATES.includes(String(item?.status || '').toUpperCase());
}

function gerParseDate(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    let d;
    if (raw instanceof Date) {
        d = raw;
    } else if (typeof raw === 'number' || /^\d{10,}$/.test(String(raw))) {
        d = new Date(Number(raw));
    } else {
        const s = String(raw);
        d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s);
    }
    return isNaN(d.getTime()) ? null : d;
}

function calculateItemDaysInCustody(item) {
    const d = gerParseDate(item?.createdAt || item?.date);
    if (!d) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / GER_DAY_MS));
}

function getCategoryEstimatedValue(category) {
    const cat = String(category || '').toLowerCase();
    if (cat.includes('laptop') || cat.includes('tecnología') || cat.includes('tecnologia')) return 2200;
    if (cat.includes('smartphone') || cat.includes('tablet') || cat.includes('celular')) return 1500;
    if (cat.includes('joya') || cat.includes('reloj')) return 450;
    if (cat.includes('billetera') || cat.includes('documento')) return 180;
    if (cat.includes('mochila') || cat.includes('bolso')) return 120;
    if (cat.includes('prenda') || cat.includes('accesorio')) return 80;
    if (cat.includes('llave')) return 40;
    return 60;
}

// Hora (0-23) del suceso a partir de "HH:MM", "h:mm pm", etc. Si no viene campo 'time', se extrae de createdAt o date.
function gerGetHour(item) {
    const t = String(item?.time || '').trim().toLowerCase();
    if (t) {
        const m = t.match(/(\d{1,2})\s*(?::\s*\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/);
        if (m) {
            let h = parseInt(m[1], 10);
            const meridiem = (m[2] || '').replace(/[\s.]/g, '');
            if (meridiem === 'pm' && h < 12) h += 12;
            if (meridiem === 'am' && h === 12) h = 0;
            if (h >= 0 && h <= 23) return h;
        }
    }
    const rawDate = item?.createdAt || item?.date;
    if (rawDate) {
        const d = gerParseDate(rawDate);
        if (d && !isNaN(d.getTime())) {
            return d.getHours();
        }
    }
    return null;
}

function gerSlotForHour(h) {
    if (h < 13) return 'morning';
    if (h < 18) return 'afternoon';
    return 'night';
}

// ----------------------------------------------------------------------------
// Datos del período (actual y anterior) y cálculos
// ----------------------------------------------------------------------------
function gerGetScopedData() {
    const all = window.currentItems || [];
    const period = document.getElementById('gerenciaPeriodFilter')?.value || 'ALL';
    const days = period === '7D' ? 7 : period === '30D' ? 30 : null;
    if (!days) return { all, period, days, current: all, previous: null };

    const now = Date.now();
    const inRange = (item, from, to) => {
        const d = gerParseDate(item.createdAt || item.date);
        if (!d) return false;
        const t = d.getTime();
        return t >= from && t < to;
    };
    return {
        all, period, days,
        current: all.filter(i => inRange(i, now - days * GER_DAY_MS, now + GER_DAY_MS)),
        previous: all.filter(i => inRange(i, now - 2 * days * GER_DAY_MS, now - days * GER_DAY_MS))
    };
}

function gerGetScopedMatches(current, period) {
    const matches = window.currentMatches || [];
    if (period === 'ALL') return matches;
    const ids = new Set(current.map(i => i.itemID));
    return matches.filter(m => ids.has(m.lostItemID) || ids.has(m.foundItemID));
}

function gerGetReservedFoundIds() {
    return new Set(
        (window.currentMatches || [])
            .filter(m => String(m.status || '').toUpperCase() === 'VALIDATED' && m.foundItemID)
            .map(m => m.foundItemID)
    );
}

function gerComputeKpis(items) {
    const lost = items.filter(i => i.type === 'LOST');
    const found = items.filter(i => i.type === 'FOUND');
    const deliveredLost = lost.filter(gerIsDelivered).length;
    const deliveredFound = found.filter(gerIsDelivered).length;
    const inCustody = found.filter(i => !gerIsDelivered(i));

    // Casos recuperados: se toma el mayor entre ambos lados para no depender
    // de cuál de los dos registros marca el backend como entregado.
    let recovered = Math.max(deliveredLost, deliveredFound);
    let returnRate;
    if (found.length > 0) {
        recovered = Math.min(recovered, found.length);
        returnRate = gerPct(recovered, found.length);
    } else {
        recovered = deliveredLost;
        returnRate = gerPct(deliveredLost, lost.length);
    }

    const avgDays = inCustody.length
        ? inCustody.reduce((sum, i) => sum + calculateItemDaysInCustody(i), 0) / inCustody.length
        : 0;

    return {
        total: items.length,
        lost: lost.length,
        found: found.length,
        recovered,
        returnRate,
        inCustody: inCustody.length,
        avgDays,
        protectedValue: found.reduce((sum, i) => sum + getCategoryEstimatedValue(i.category), 0)
    };
}

function gerComputeAnalytics(items) {
    const zoneMap = {};
    const catMap = {};
    const zoneCatMap = {};
    const slots = { morning: 0, afternoon: 0, night: 0, unknown: 0 };
    const heat = Array.from({ length: 7 }, () => ({ morning: 0, afternoon: 0, night: 0 }));
    let heatTotal = 0;

    items.forEach(i => {
        const zone = (i.zone && i.zone !== 'Zona no indicada') ? i.zone : 'Sin zona indicada';
        zoneMap[zone] = (zoneMap[zone] || 0) + 1;

        const cat = i.category || 'Otros';
        catMap[cat] = (catMap[cat] || 0) + 1;
        zoneCatMap[zone] = zoneCatMap[zone] || {};
        zoneCatMap[zone][cat] = (zoneCatMap[zone][cat] || 0) + 1;

        const hour = gerGetHour(i);
        const slot = hour === null ? null : gerSlotForHour(hour);
        if (slot) slots[slot]++; else slots.unknown++;

        if (slot) {
            const d = gerParseDate(i.date || i.createdAt);
            if (d) {
                heat[(d.getDay() + 6) % 7][slot]++;
                heatTotal++;
            }
        }
    });

    const toRanking = (map) => Object.entries(map)
        .map(([name, count]) => ({ name, count, pct: gerPct(count, items.length) }))
        .sort((a, b) => b.count - a.count);

    const zones = toRanking(zoneMap);
    let topZoneCategory = null;
    if (zones[0]) {
        const entries = Object.entries(zoneCatMap[zones[0].name] || {}).sort((x, y) => y[1] - x[1]);
        if (entries[0]) topZoneCategory = entries[0][0];
    }

    const slotTotal = slots.morning + slots.afternoon + slots.night;
    let peakSlot = null;
    if (slotTotal > 0) {
        peakSlot = GER_SLOT_KEYS.reduce((best, key) => (slots[key] > slots[best] ? key : best), 'morning');
    }

    let heatMax = 0;
    heat.forEach(row => GER_SLOT_KEYS.forEach(k => { heatMax = Math.max(heatMax, row[k]); }));

    return { zones, topZoneCategory, categories: toRanking(catMap), slots, slotTotal, peakSlot, heat, heatMax, heatTotal };
}

function gerComputeAi(matches) {
    const total = matches.length;
    const scores = matches.map(m => gerNormScore(m.matchScore)).filter(s => s > 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const statusOf = (m) => String(m.status || '').toUpperCase();
    const validated = matches.filter(m => statusOf(m) === 'VALIDATED').length;
    const rejected = matches.filter(m => statusOf(m) === 'REJECTED').length;
    const pending = matches.filter(m => statusOf(m) === 'POSSIBLE').length;
    const decided = validated + rejected;
    return {
        total, avgScore, validated, rejected, pending, decided,
        high: scores.filter(s => s >= 80).length,
        precision: decided > 0 ? gerPct(validated, decided) : null
    };
}

function gerComputeFunnel(current) {
    const lostItems = current.filter(i => i.type === 'LOST');
    const lostIds = new Set(lostItems.map(i => i.itemID));
    const withMatch = new Set();
    const validated = new Set();
    const delivered = new Set();

    (window.currentMatches || []).forEach(m => {
        if (!lostIds.has(m.lostItemID)) return;
        const st = String(m.status || '').toUpperCase();
        if (st !== 'REJECTED') withMatch.add(m.lostItemID);
        if (st === 'VALIDATED') validated.add(m.lostItemID);
    });
    lostItems.forEach(i => {
        if (gerIsDelivered(i)) { delivered.add(i.itemID); validated.add(i.itemID); withMatch.add(i.itemID); }
        else if (gerIsValidated(i)) { validated.add(i.itemID); withMatch.add(i.itemID); }
    });

    return [
        { 
            stepNum: 1, 
            label: 'Reportes de Pérdida', 
            sub: 'Casos registrados por clientes', 
            count: lostItems.length, 
            color: 'bg-sky-500',
            badgeBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
        },
        { 
            stepNum: 2, 
            label: 'Matches de IA (Nova Lite)', 
            sub: 'Emparejados automáticamente', 
            count: withMatch.size, 
            color: 'bg-indigo-500',
            badgeBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
        },
        { 
            stepNum: 3, 
            label: 'Validados por Seguridad', 
            sub: 'Confirmados por el personal', 
            count: validated.size, 
            color: 'bg-amber-500',
            badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
        },
        { 
            stepNum: 4, 
            label: 'Entregados al Propietario', 
            sub: 'Bienes devueltos satisfactoriamente', 
            count: delivered.size, 
            color: 'bg-emerald-500',
            badgeBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
        }
    ];
}

function gerComputeOperationalState(all) {
    const matches = window.currentMatches || [];
    const reserved = gerGetReservedFoundIds();
    const statusOf = (m) => String(m.status || '').toUpperCase();
    const matchedFound = new Set(matches.filter(m => statusOf(m) !== 'REJECTED' && m.foundItemID).map(m => m.foundItemID));

    const foundActive = all.filter(i => i.type === 'FOUND' && !gerIsDelivered(i));
    const lot = foundActive
        .filter(i => !reserved.has(i.itemID) && calculateItemDaysInCustody(i) >= GER_DONATION_DAYS)
        .sort((a, b) => calculateItemDaysInCustody(b) - calculateItemDaysInCustody(a));
    const legal = lot.filter(i => calculateItemDaysInCustody(i) >= GER_LEGAL_DAYS);
    const warning = foundActive.filter(i => {
        const d = calculateItemDaysInCustody(i);
        return !reserved.has(i.itemID) && d >= GER_WARNING_DAYS && d < GER_DONATION_DAYS;
    });

    const lostValidatedPending = all.filter(i => i.type === 'LOST' && gerIsValidated(i) && !gerIsDelivered(i)).length;
    const reservedFoundPending = foundActive.filter(i => reserved.has(i.itemID)).length;
    const matchesAvailable = matches.length > 0;

    return {
        lot, legal, warning,
        pendingMatches: matches.filter(m => statusOf(m) === 'POSSIBLE').length,
        awaitingPickup: Math.max(lostValidatedPending, reservedFoundPending),
        unmatchedFound: matchesAvailable
            ? foundActive.filter(i => !matchedFound.has(i.itemID) && !reserved.has(i.itemID) && calculateItemDaysInCustody(i) >= 7).length
            : 0
    };
}

// ----------------------------------------------------------------------------
// Render: KPIs
// ----------------------------------------------------------------------------
function gerDeltaBadge(cur, prev, mode, goodDirection) {
    if (prev === null || prev === undefined) return '';
    let diff;
    let text;
    if (mode === 'pp') {
        diff = Math.round(cur - prev);
        text = `${diff > 0 ? '+' : ''}${diff} pp`;
    } else if (prev === 0) {
        if (cur === 0) return '';
        diff = 1;
        text = 'nuevo';
    } else {
        diff = Math.round(((cur - prev) / prev) * 100);
        text = `${diff > 0 ? '+' : ''}${diff}%`;
    }
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '■';
    let color = 'text-slate-500 dark:text-slate-400 bg-slate-500/10';
    if (diff !== 0 && goodDirection) {
        const good = (goodDirection === 'up') === (diff > 0);
        color = good
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
            : 'text-rose-600 dark:text-rose-400 bg-rose-500/10';
    }
    return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${color}">${arrow} ${text} <span class="font-medium opacity-70">vs. previo</span></span>`;
}

function renderGerenciaKpis(k, prevK, op) {
    gerSetText('kpiTotalItems', k.total);
    gerSetText('kpiTotalSub', `${k.lost} perdidos / ${k.found} hallazgos`);
    gerSetHtml('kpiTotalDelta', prevK ? gerDeltaBadge(k.total, prevK.total, 'pct', null) : '');

    gerSetText('kpiRecoveryRate', `${k.returnRate}%`);
    gerSetText('kpiRecoverySub', k.found ? `${k.recovered} de ${k.found} hallazgos devueltos` : 'Sin hallazgos registrados');
    gerSetHtml('kpiRecoveryDelta', prevK ? gerDeltaBadge(k.returnRate, prevK.returnRate, 'pp', 'up') : '');

    gerSetText('kpiAvgDays', `${k.avgDays.toFixed(1)} d`);
    gerSetText('kpiAvgDaysSub', 'Promedio hasta retiro');

    gerSetText('kpiDonationEligible', op.lot.length);
    gerSetText('kpiDonationSub', op.legal.length ? `${gerN(op.legal.length, 'supera', 'superan')} los 90 días` : 'Superan 30 días en almacén');

    gerSetText('kpiEstimatedValue', gerMoney(k.protectedValue));
    gerSetText('kpiValueSub', 'Impacto económico estimado');
    gerSetHtml('kpiValueDelta', prevK ? gerDeltaBadge(k.protectedValue, prevK.protectedValue, 'pct', null) : '');
}

// ----------------------------------------------------------------------------
// Render: resumen ejecutivo y acciones prioritarias
// ----------------------------------------------------------------------------
function renderInsights(ctx) {
    const { k, a, op, ai, period } = ctx;
    const periodLabel = period === '7D' ? 'los últimos 7 días' : period === '30D' ? 'los últimos 30 días' : 'todo el histórico';
    const lines = [];

    if (k.total === 0) {
        lines.push({ icon: '📭', text: `No hay registros en ${periodLabel}. Cuando lleguen reportes y hallazgos, aquí aparecerá el resumen.` });
    } else {
        lines.push({ icon: '📊', text: `En ${periodLabel} se registraron ${k.total} casos (${k.lost} pérdidas reportadas y ${k.found} hallazgos). Se ${k.recovered === 1 ? 'devolvió' : 'devolvieron'} ${gerN(k.recovered, 'objeto', 'objetos')}: tasa de retorno del ${k.returnRate}%.` });

        const topZone = a.zones[0];
        const topCat = a.categories[0];
        if (topZone) {
            let text = `El ${topZone.pct}% de los incidentes se concentra en "${topZone.name}"`;
            if (a.peakSlot) text += `, con mayor actividad en la franja de ${GER_SLOTS[a.peakSlot].label.toLowerCase()} (${GER_SLOTS[a.peakSlot].range})`;
            text += topCat ? `. La categoría más frecuente es "${topCat.name}".` : '.';
            lines.push({ icon: '📍', text });
        }

        if (k.inCustody > 0) {
            let text = `Hay ${gerN(k.inCustody, 'objeto', 'objetos')} en custodia, con una permanencia promedio de ${k.avgDays.toFixed(1)} días`;
            if (op.lot.length > 0) text += `; ${op.lot.length} ya ${op.lot.length === 1 ? 'cumple' : 'cumplen'} el plazo de donación`;
            if (op.legal.length > 0) text += ` y ${op.legal.length} ${op.legal.length === 1 ? 'supera' : 'superan'} los 90 días`;
            lines.push({ icon: '📦', text: `${text}.` });
        }
    }

    if (ai.total > 0) {
        let text = `El motor de coincidencias analizó ${gerN(ai.total, 'posible emparejamiento', 'posibles emparejamientos')} con un puntaje promedio de ${ai.avgScore}%`;
        if (ai.precision !== null) text += ` y una precisión validada por el personal del ${ai.precision}%`;
        lines.push({ icon: '🤖', text: `${text}.` });
    }

    if (op.pendingMatches > 0) {
        lines.push({ icon: '⚡', text: `Acción sugerida: revisar ${gerN(op.pendingMatches, 'coincidencia pendiente', 'coincidencias pendientes')} para acelerar las devoluciones.` });
    }

    gerSetHtml('insightsContainer', lines.map(l => `
        <li class="flex items-start gap-2.5">
            <span class="text-sm leading-5 shrink-0">${l.icon}</span>
            <span>${escapeHtml(l.text)}</span>
        </li>
    `).join(''));

    window.gerenciaInsightsText = `RESUMEN EJECUTIVO — Lost & Found (${periodLabel})\n` + lines.map(l => `- ${l.text}`).join('\n');
}

function renderAlerts(op) {
    const alerts = [];
    if (op.legal.length) {
        alerts.push({ 
            tone: 'rose', 
            icon: '🔴', 
            badge: 'Baja Legal',
            title: `${gerN(op.legal.length, 'objeto supera', 'objetos superan')} los 90 días`, 
            text: 'Corresponde disposición final / baja definitiva de custodia.', 
            action: 'lot-legal', 
            btn: 'Ver lote legal' 
        });
    }
    const donationOnly = op.lot.length - op.legal.length;
    if (donationOnly > 0) {
        alerts.push({ 
            tone: 'amber', 
            icon: '🟡', 
            badge: 'Donación',
            title: `${gerN(donationOnly, 'objeto listo', 'objetos listos')} para donación`, 
            text: 'Superan los 30 días en custodia sin reclamo del propietario.', 
            action: 'lot-donation', 
            btn: 'Ver lote donación' 
        });
    }
    if (op.pendingMatches) {
        alerts.push({ 
            tone: 'indigo', 
            icon: '🔎', 
            badge: 'IA Nova Lite',
            title: `${gerN(op.pendingMatches, 'coincidencia por revisar', 'coincidencias por revisar')}`, 
            text: 'Amazon Bedrock sugirió emparejamientos que requieren validación del personal.', 
            action: 'matches', 
            btn: 'Revisar matches' 
        });
    }
    if (op.awaitingPickup) {
        alerts.push({ 
            tone: 'emerald', 
            icon: '🎫', 
            badge: 'Módulo de Entrega',
            title: `${gerN(op.awaitingPickup, 'objeto validado', 'objetos validados')} listo para retiro`, 
            text: 'El dueño ya fue identificado; pendiente verificación de código y entrega en ventanilla.', 
            action: 'pickup', 
            btn: 'Ir a entregas' 
        });
    }
    if (op.warning.length) {
        alerts.push({ 
            tone: 'sky', 
            icon: '⏳', 
            badge: 'Custodia',
            title: `${gerN(op.warning.length, 'objeto cerca', 'objetos cerca')} de los 30 días`, 
            text: 'Tienen entre 20 y 29 días en almacén; aún dentro del plazo de reclamo.', 
            action: 'lot-donation', 
            btn: 'Ver custodia' 
        });
    }
    if (op.unmatchedFound) {
        alerts.push({ 
            tone: 'slate', 
            icon: '❔', 
            badge: 'Sin match',
            title: `${gerN(op.unmatchedFound, 'hallazgo sin coincidencia', 'hallazgos sin coincidencia')}`, 
            text: 'Llevan 7 días o más en custodia sin reportes de pérdida asociados.' 
        });
    }

    const toneClasses = {
        rose: 'bg-rose-500/10 border-rose-500/25',
        amber: 'bg-amber-500/10 border-amber-500/25',
        sky: 'bg-sky-500/10 border-sky-500/25',
        indigo: 'bg-indigo-500/10 border-indigo-500/25',
        emerald: 'bg-emerald-500/10 border-emerald-500/25',
        slate: 'bg-slate-500/10 border-slate-500/25'
    };

    if (alerts.length === 0) {
        gerSetHtml('gerenciaAlertsContainer', `
            <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-center">
                <p class="font-bold text-emerald-600 dark:text-emerald-400">✓ Todo al día</p>
                <p class="theme-text-secondary mt-0.5">No hay acciones urgentes pendientes en este momento.</p>
            </div>
        `);
        return;
    }

    gerSetHtml('gerenciaAlertsContainer', alerts.map(al => `
        <div class="flex items-start justify-between gap-3 p-3.5 rounded-2xl border ${toneClasses[al.tone]} transition-all">
            <div class="flex items-start gap-2.5 min-w-0">
                <span class="text-base leading-5 shrink-0 mt-0.5">${al.icon}</span>
                <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 theme-text-secondary">${al.badge}</span>
                        <p class="text-xs font-bold theme-text-primary truncate">${escapeHtml(al.title)}</p>
                    </div>
                    <p class="text-[11px] theme-text-secondary mt-1 leading-snug">${escapeHtml(al.text)}</p>
                </div>
            </div>
            ${al.action ? `
                <button type="button" data-ger-action="${al.action}" class="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 theme-text-primary hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm transition-all cursor-pointer">
                    ${al.btn}
                </button>` : ''}
        </div>
    `).join(''));
}

// ----------------------------------------------------------------------------
// Render: puntos calientes, horarios, categorías
// ----------------------------------------------------------------------------
function renderHotspots(a, itemCount) {
    const container = document.getElementById('hotspotsContainer');
    if (!container) return;

    if (itemCount === 0) {
        container.innerHTML = '<p class="text-xs theme-text-muted py-4 text-center">No hay registros suficientes para calcular puntos calientes.</p>';
        gerSetText('hotspotRecommendationText', 'Aún no hay datos suficientes para generar una recomendación operativa.');
        return;
    }

    const top = a.zones.slice(0, 6);
    const rest = a.zones.slice(6);

    container.innerHTML = top.map((item, index) => {
        let rankClass = 'hotspot-rank-other';
        let badgeColor = 'text-sky-600 bg-sky-500/10';
        if (index === 0) { rankClass = 'hotspot-rank-1'; badgeColor = 'text-rose-600 bg-rose-500/10 font-bold'; }
        else if (index === 1) { rankClass = 'hotspot-rank-2'; badgeColor = 'text-amber-600 bg-amber-500/10 font-bold'; }
        else if (index === 2) { rankClass = 'hotspot-rank-3'; badgeColor = 'text-amber-500 bg-amber-500/10'; }

        return `
            <div class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-medium theme-text-primary flex items-center gap-1.5 min-w-0">
                        <span class="text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold shrink-0 ${badgeColor}">${index + 1}</span>
                        <span class="truncate">${escapeHtml(item.name)}</span>
                    </span>
                    <span class="font-mono text-[11px] theme-text-secondary font-semibold shrink-0 ml-2">${item.count} casos (${item.pct}%)</span>
                </div>
                <div class="hotspot-bar-wrapper">
                    <div class="hotspot-bar-fill ${rankClass}" style="width: ${Math.max(item.pct, 5)}%"></div>
                </div>
            </div>
        `;
    }).join('') + (rest.length
        ? `<p class="text-[11px] theme-text-muted pt-1">+ ${gerN(rest.length, 'zona más', 'zonas más')} con ${gerN(rest.reduce((s, z) => s + z.count, 0), 'caso', 'casos')} en total</p>`
        : '');

    // Recomendación dinámica según zona, franja y categoría dominantes
    const z = a.zones[0];
    const slot = a.peakSlot ? GER_SLOTS[a.peakSlot] : null;
    const zoneCat = a.topZoneCategory;
    let text;
    if (z.pct >= 30) {
        text = `Se detectó que el ${z.pct}% de los incidentes se concentra en "${z.name}". `;
        text += slot
            ? `La mayor actividad ocurre en la franja de ${slot.label.toLowerCase()} (${slot.range}). Se recomienda asignar patrullaje preventivo en ese horario y `
            : 'Se recomienda asignar patrullaje preventivo y ';
        text += 'colocar avisos preventivos para los visitantes en este sector';
        text += zoneCat ? `, con énfasis en los objetos de categoría "${zoneCat}", la más frecuente allí.` : '.';
    } else {
        text = `Los incidentes están repartidos entre varias zonas; la principal, "${z.name}", concentra el ${z.pct}%. Se recomienda reforzar las campañas generales de prevención`;
        text += slot ? ` y la presencia de seguridad en la franja de ${slot.label.toLowerCase()} (${slot.range}).` : '.';
    }
    gerSetText('hotspotRecommendationText', text);
}

function renderTimeAndCategories(a, itemCount) {
    if (a.slotTotal === 0) {
        gerSetHtml('timeDistributionContainer', '<p class="text-xs theme-text-muted py-2">Aún no hay registros con hora indicada.</p>');
    } else {
        let html = GER_SLOT_KEYS.map(key => {
            const s = GER_SLOTS[key];
            const c = a.slots[key];
            const p = gerPct(c, a.slotTotal);
            const isPeak = a.peakSlot === key;
            return `
                <div class="${isPeak ? 'p-2 rounded-xl bg-amber-500/10' : 'px-2 py-1'} space-y-1">
                    <div class="flex items-center justify-between">
                        <span class="${isPeak ? 'font-bold text-amber-600 dark:text-amber-400' : 'theme-text-secondary'}">${s.icon} ${s.label} (${s.range})${isPeak ? ' · pico' : ''}</span>
                        <span class="font-mono font-semibold ${isPeak ? 'text-amber-600 dark:text-amber-400' : 'theme-text-primary'}">${c} (${p}%)</span>
                    </div>
                    <div class="hotspot-bar-wrapper">
                        <div class="hotspot-bar-fill ${isPeak ? 'hotspot-rank-2' : 'hotspot-rank-other'}" style="width: ${c > 0 ? Math.max(p, 4) : 0}%"></div>
                    </div>
                </div>`;
        }).join('');
        if (a.slots.unknown > 0) {
            html += `<p class="text-[10px] theme-text-muted px-2 pt-1">${a.slots.unknown} registro(s) sin hora indicada no se incluyen en este cálculo.</p>`;
        }
        gerSetHtml('timeDistributionContainer', html);
    }

    const topCats = a.categories.slice(0, 5);
    gerSetHtml('categoriesRankingContainer', topCats.length
        ? topCats.map((c, idx) => `
            <div class="space-y-1">
                <div class="flex items-center justify-between">
                    <span class="theme-text-secondary truncate max-w-[200px]">${idx + 1}. ${escapeHtml(c.name)}</span>
                    <span class="font-mono font-semibold theme-text-primary">${c.count} (${c.pct}%)</span>
                </div>
                <div class="hotspot-bar-wrapper"><div class="hotspot-bar-fill hotspot-rank-other" style="width: ${Math.max(c.pct, 4)}%"></div></div>
            </div>`).join('')
        : '<p class="text-xs theme-text-muted">Sin categorías registradas</p>');
}

// ----------------------------------------------------------------------------
// Render: tendencia, embudo, mapa de calor semanal, rendimiento IA
// ----------------------------------------------------------------------------
function renderTrend(items, days) {
    const container = document.getElementById('trendChartContainer');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Si no se especificó 'days' explícito (ej: filtro ALL), adaptamos el ancho a la antigüedad de los datos
    let n = days;
    if (!n) {
        let minTime = today.getTime();
        items.forEach(i => {
            const d = gerParseDate(i.createdAt || i.date);
            if (d && !isNaN(d.getTime())) minTime = Math.min(minTime, d.getTime());
        });
        const spanDays = Math.ceil((today.getTime() - minTime) / GER_DAY_MS) + 1;
        // Si todos los datos son recientes (≤7 días), usamos 7 días para que las barras se vean grandes y centradas
        n = spanDays <= 7 ? 7 : spanDays <= 14 ? 14 : 30;
    }

    gerSetText('trendSubtitle', `Pérdidas reportadas vs. hallazgos registrados por día · ${n === 7 ? 'últimos 7 días' : n === 14 ? 'últimas 2 semanas' : 'últimos 30 días'}`);

    const buckets = Array.from({ length: n }, (_, idx) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (n - 1 - idx));
        return { date: d, lost: 0, found: 0 };
    });

    items.forEach(i => {
        const d = gerParseDate(i.createdAt || i.date);
        if (!d) return;
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        const idx = Math.round((day.getTime() - today.getTime()) / GER_DAY_MS) + (n - 1);
        if (idx < 0 || idx >= n) return;
        if (i.type === 'FOUND') buckets[idx].found++; else buckets[idx].lost++;
    });

    const max = Math.max(1, ...buckets.map(b => Math.max(b.lost, b.found)));
    const totalShown = buckets.reduce((s, b) => s + b.lost + b.found, 0);
    if (totalShown === 0) {
        container.innerHTML = '<p class="text-xs theme-text-muted py-10 text-center">No hay registros en los últimos días para graficar.</p>';
        return;
    }

    const labelEvery = n <= 7 ? 1 : n <= 14 ? 2 : 5;
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const weekdayShort = (d) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
    const barMaxWidth = n <= 7 ? 'max-w-[28px]' : n <= 14 ? 'max-w-[18px]' : 'max-w-[10px]';

    container.innerHTML = `
        <div class="flex items-end gap-1.5 sm:gap-2 h-40 border-b border-slate-200 dark:border-slate-700 pb-1 pt-6 px-1">
            ${buckets.map(b => {
                const isToday = b.date.getTime() === today.getTime();
                return `
                <div class="flex-1 min-w-0 h-full flex flex-col justify-end items-center group relative cursor-pointer" title="${fmt(b.date)} (${weekdayShort(b.date)}) · ${b.lost} perdidos, ${b.found} hallazgos">
                    <div class="flex items-end justify-center gap-1 w-full h-full pb-0.5">
                        <!-- Barra Perdidos -->
                        <div class="flex flex-col items-center justify-end h-full w-full ${barMaxWidth}">
                            ${b.lost > 0 ? `<span class="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 mb-0.5">${b.lost}</span>` : ''}
                            <div class="ger-trend-bar bg-sky-500 w-full rounded-t-md transition-all group-hover:brightness-110" style="height: ${b.lost ? Math.max((b.lost / max) * 100, 12) : 0}%"></div>
                        </div>
                        <!-- Barra Hallazgos -->
                        <div class="flex flex-col items-center justify-end h-full w-full ${barMaxWidth}">
                            ${b.found > 0 ? `<span class="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 mb-0.5">${b.found}</span>` : ''}
                            <div class="ger-trend-bar bg-emerald-500 w-full rounded-t-md transition-all group-hover:brightness-110" style="height: ${b.found ? Math.max((b.found / max) * 100, 12) : 0}%"></div>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>
        <div class="flex gap-1.5 sm:gap-2 mt-2 px-1">
            ${buckets.map((b, idx) => {
                const showLabel = (n - 1 - idx) % labelEvery === 0;
                const isToday = b.date.getTime() === today.getTime();
                return `
                <div class="flex-1 min-w-0 text-center ${isToday ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'theme-text-muted'}">
                    ${showLabel ? `
                        <div class="text-[10px] font-mono leading-none">${fmt(b.date)}</div>
                        ${n <= 7 ? `<div class="text-[9px] uppercase tracking-wider mt-0.5 opacity-75">${weekdayShort(b.date)}</div>` : ''}
                    ` : ''}
                </div>`;
            }).join('')}
        </div>
        <div class="flex items-center justify-between text-[10px] theme-text-muted mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Máximo diario: <strong>${max} caso${max === 1 ? '' : 's'}</strong></span>
            <span>💡 Cifras mostradas sobre las barras para lectura inmediata</span>
        </div>
    `;
}

function renderFunnel(current) {
    const stages = gerComputeFunnel(current);
    const base = stages[0].count;
    if (base === 0) {
        gerSetHtml('funnelContainer', '<p class="text-xs theme-text-muted py-6 text-center">Aún no hay pérdidas reportadas en este período.</p>');
        return;
    }
    gerSetHtml('funnelContainer', stages.map((s, idx) => {
        const pctOfBase = gerPct(s.count, base);
        let conversionNote = '';
        if (idx === 1) {
            const rate = base > 0 ? Math.round((s.count / base) * 100) : 0;
            conversionNote = `<div class="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 mt-0.5">
                <span>↳</span> <span><strong>Cobertura IA:</strong> ${rate}% de los reportes tuvieron match</span>
            </div>`;
        } else if (idx === 2) {
            const prev = stages[1].count;
            const rate = prev > 0 ? Math.round((s.count / prev) * 100) : 0;
            conversionNote = `<div class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                <span>↳</span> <span><strong>Precisión Staff:</strong> ${rate}% de las alertas IA fueron validadas</span>
            </div>`;
        } else if (idx === 3) {
            const prev = stages[2].count;
            const rate = prev > 0 ? Math.round((s.count / prev) * 100) : 0;
            conversionNote = `<div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <span>↳</span> <span><strong>Éxito de Retiro:</strong> ${rate}% de los validados ya fueron devueltos</span>
            </div>`;
        }

        return `
            <div class="p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-1 transition-all">
                <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${s.badgeBg} border shrink-0">
                            ${s.stepNum}
                        </span>
                        <div class="truncate">
                            <span class="theme-text-primary font-bold text-xs">${s.label}</span>
                            <span class="text-[10px] theme-text-muted hidden sm:inline ml-1">· ${s.sub}</span>
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                        <span class="font-mono font-bold text-sm theme-text-primary">${s.count}</span>
                        <span class="text-[10px] theme-text-muted">${s.count === 1 ? 'objeto' : 'objetos'}</span>
                        <span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 ml-1">(${pctOfBase}%)</span>
                    </div>
                </div>
                <div class="hotspot-bar-wrapper" style="height: 8px;">
                    <div class="ger-funnel-fill ${s.color}" style="width: ${s.count > 0 ? Math.max(pctOfBase, 4) : 0}%"></div>
                </div>
                ${conversionNote}
            </div>`;
    }).join(''));
}

function renderWeekdayHeatmap(a) {
    const container = document.getElementById('weekdayHeatmapContainer');
    if (!container) return;
    if (a.heatTotal === 0) {
        container.innerHTML = '<p class="text-xs theme-text-muted py-8 text-center">Aún no hay registros con fecha y hora para construir el mapa de calor.</p>';
        return;
    }

    let peak = { day: 0, slot: 'morning', count: -1 };
    a.heat.forEach((row, dayIdx) => GER_SLOT_KEYS.forEach(k => {
        if (row[k] > peak.count) peak = { day: dayIdx, slot: k, count: row[k] };
    }));

    const header = `
        <div></div>
        ${GER_SLOT_KEYS.map(k => `<div class="text-center text-[10px] font-bold theme-text-secondary">${GER_SLOTS[k].icon} ${GER_SLOTS[k].label}<br><span class="font-normal theme-text-muted">${GER_SLOTS[k].range}</span></div>`).join('')}
    `;
    const rows = a.heat.map((row, dayIdx) => `
        <div class="text-[11px] font-bold theme-text-secondary flex items-center">${GER_WEEKDAYS[dayIdx]}</div>
        ${GER_SLOT_KEYS.map(k => {
            const c = row[k];
            const alpha = a.heatMax > 0 ? (c / a.heatMax) : 0;
            const isPeak = c > 0 && peak.day === dayIdx && peak.slot === k;
            return `<div class="ger-heat-cell ${isPeak ? 'ger-heat-peak' : ''}" style="background: rgba(244, 63, 94, ${c ? (0.12 + alpha * 0.7).toFixed(2) : 0.05}); color: ${alpha > 0.55 ? '#ffffff' : 'inherit'};" title="${GER_WEEKDAYS[dayIdx]} · ${GER_SLOTS[k].label}: ${c} caso(s)">${c || '·'}</div>`;
        }).join('')}
    `).join('');

    container.innerHTML = `
        <div class="grid gap-1.5" style="grid-template-columns: 44px repeat(3, minmax(0, 1fr));">
            ${header}
            ${rows}
        </div>
        <p class="text-[11px] theme-text-secondary mt-3">
            Momento más crítico: <strong class="theme-text-primary">${GER_WEEKDAYS[peak.day]} por la ${GER_SLOTS[peak.slot].label.toLowerCase()}</strong> con ${peak.count} caso(s).
        </p>
    `;
}

function renderAiPerformance(ai) {
    const container = document.getElementById('aiPerformanceContainer');
    if (!container) return;
    if (ai.total === 0) {
        container.innerHTML = '<p class="text-xs theme-text-muted py-8 text-center">Todavía no hay coincidencias generadas por la IA para este período.</p>';
        return;
    }
    const pV = gerPct(ai.validated, ai.total);
    const pR = gerPct(ai.rejected, ai.total);
    const pP = Math.max(0, 100 - pV - pR);

    const stat = (label, value, sub) => `
        <div class="p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p class="text-[10px] font-bold uppercase tracking-wider theme-text-muted">${label}</p>
            <p class="text-xl font-extrabold font-heading theme-text-primary mt-0.5">${value}</p>
            <p class="text-[10px] theme-text-muted">${sub}</p>
        </div>`;

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-2.5">
            ${stat('Coincidencias', ai.total, `${ai.high} con puntaje ≥ 80%`)}
            ${stat('Puntaje promedio', `${ai.avgScore}%`, 'Similitud estimada por Bedrock')}
            ${stat('Precisión validada', ai.precision !== null ? `${ai.precision}%` : '—', ai.decided ? `${ai.validated} validadas de ${ai.decided} resueltas` : 'Sin decisiones del personal aún')}
            ${stat('Por revisar', ai.pending, 'Esperan decisión del staff')}
        </div>
        <div class="mt-3.5">
            <div class="flex h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                <div class="bg-emerald-500" style="width: ${pV}%" title="Validadas"></div>
                <div class="bg-rose-500" style="width: ${pR}%" title="Rechazadas"></div>
                <div class="bg-amber-400" style="width: ${pP}%" title="Pendientes"></div>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] theme-text-secondary">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Validadas ${ai.validated}</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-500"></span> Rechazadas ${ai.rejected}</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span> Pendientes ${ai.pending}</span>
            </div>
        </div>
    `;
}

// ----------------------------------------------------------------------------
// Render principal del dashboard
// ----------------------------------------------------------------------------
function renderGerenciaDashboard() {
    const { all, period, days, current, previous } = gerGetScopedData();

    const k = gerComputeKpis(current);
    const prevK = previous ? gerComputeKpis(previous) : null;
    const a = gerComputeAnalytics(current);
    const op = gerComputeOperationalState(all);
    const ai = gerComputeAi(gerGetScopedMatches(current, period));

    renderGerenciaKpis(k, prevK, op);
    renderInsights({ k, a, op, ai, period });
    renderAlerts(op);
    renderHotspots(a, current.length);
    renderTimeAndCategories(a, current.length);
    renderTrend(current, days);
    renderFunnel(current);
    renderWeekdayHeatmap(a);
    renderAiPerformance(ai);
    renderDonationsTable(op.lot);

    if (window.lastSyncAt) {
        const t = new Date(window.lastSyncAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        gerSetText('gerenciaLastSync', `● Actualizado ${t}`);
    }

    if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------------------------------
// Tabla de custodia y donaciones (filtros + selección)
// ----------------------------------------------------------------------------
function gerGetFilteredLot() {
    const lot = window.gerenciaDonationLot || [];
    const f = window.gerenciaDonationFilter;
    if (f === 'D30') return lot.filter(i => calculateItemDaysInCustody(i) < GER_LEGAL_DAYS);
    if (f === 'D90') return lot.filter(i => calculateItemDaysInCustody(i) >= GER_LEGAL_DAYS);
    return lot;
}

function gerUpdateLotActaButton() {
    const selected = window.gerenciaSelectedIds.size;
    const label = selected > 0
        ? `Emitir acta de seleccionados (${selected})`
        : `Emitir Acta Oficial del Lote (${gerGetFilteredLot().length})`;
    gerSetText('lotActaLabel', label);
}

function renderDonationsTable(lot) {
    window.gerenciaDonationLot = lot;

    // Limpiar selecciones de objetos que ya no están en el lote
    const validIds = new Set(lot.map(i => i.itemID));
    window.gerenciaSelectedIds.forEach(id => { if (!validIds.has(id)) window.gerenciaSelectedIds.delete(id); });

    const legalCount = lot.filter(i => calculateItemDaysInCustody(i) >= GER_LEGAL_DAYS).length;
    const donationCount = lot.length - legalCount;
    gerSetText('donationsCounterBadge', `${lot.length} objeto${lot.length === 1 ? '' : 's'} listo${lot.length === 1 ? '' : 's'}`);

    const chip = (key, label, count) => {
        const active = window.gerenciaDonationFilter === key;
        return `<button type="button" data-filter="${key}" class="px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${active
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'theme-text-secondary border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}">${label} (${count})</button>`;
    };
    gerSetHtml('donationFilterChips', chip('ALL', 'Todos', lot.length) + chip('D30', '🟡 Donación', donationCount) + chip('D90', '🔴 Plazo legal', legalCount));

    const lotValue = lot.reduce((s, i) => s + getCategoryEstimatedValue(i.category), 0);
    gerSetText('donationsSummary', lot.length ? `Valor referencial del lote: ${gerMoney(lotValue)}` : '');

    const tbody = document.getElementById('donationsTableBody');
    if (!tbody) return;

    const visible = gerGetFilteredLot();
    const selectAll = document.getElementById('selectAllDonations');

    if (visible.length === 0) {
        const emptyAll = lot.length === 0;
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="p-8 text-center theme-text-muted text-xs">
                    <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 mb-2">
                        <i data-lucide="check" class="w-5 h-5"></i>
                    </div>
                    <p class="font-semibold theme-text-primary">${emptyAll ? 'Inventario de Almacén al Día' : 'Sin objetos en esta categoría'}</p>
                    <p class="text-[11px] mt-0.5">${emptyAll ? 'Actualmente ningún objeto en custodia supera los 30 días reglamentarios sin reclamar.' : 'Cambia el filtro para ver otros objetos del lote.'}</p>
                </td>
            </tr>`;
        if (selectAll) { selectAll.checked = false; selectAll.disabled = true; }
        gerUpdateLotActaButton();
        return;
    }

    if (selectAll) {
        selectAll.disabled = false;
        selectAll.checked = visible.every(i => window.gerenciaSelectedIds.has(i.itemID));
    }

    tbody.innerHTML = visible.map((item) => {
        const days = calculateItemDaysInCustody(item);
        const isCritical = days >= GER_LEGAL_DAYS;
        const legalBadge = isCritical
            ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 whitespace-nowrap">🔴 Plazo Legal (&gt;90d)</span>'
            : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">🟡 Donación (&gt;30d)</span>';
        const checked = window.gerenciaSelectedIds.has(item.itemID) ? 'checked' : '';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                <td class="p-3"><input type="checkbox" class="row-check accent-indigo-600 cursor-pointer" data-item-id="${escapeHtml(item.itemID)}" ${checked} aria-label="Seleccionar ${escapeHtml(item.title)}"></td>
                <td class="p-3 font-mono text-[11px] theme-text-primary font-bold">${escapeHtml(item.pickupCode || item.itemID?.slice(0, 8) || 'S/C')}</td>
                <td class="p-3">
                    <span class="font-bold theme-text-primary">${escapeHtml(item.title)}</span>
                    <p class="text-[10px] theme-text-muted truncate max-w-xs">${escapeHtml(item.description)}</p>
                </td>
                <td class="p-3 theme-text-secondary">${escapeHtml(item.category)}</td>
                <td class="p-3 theme-text-secondary">${escapeHtml(item.zone)}</td>
                <td class="p-3 theme-text-muted whitespace-nowrap">${formatDate(item.createdAt || item.date)}</td>
                <td class="p-3 text-center font-mono font-bold ${isCritical ? 'text-rose-600' : 'text-amber-600'}">${days} d</td>
                <td class="p-3">${legalBadge}</td>
                <td class="p-3 text-right">
                    <button type="button" class="btn-single-acta px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer whitespace-nowrap" data-item-id="${escapeHtml(item.itemID)}">
                        Ver en Acta
                    </button>
                </td>
            </tr>`;
    }).join('');

    gerUpdateLotActaButton();
}

// ----------------------------------------------------------------------------
// Acta oficial de donación
// ----------------------------------------------------------------------------
function gerFolioKey() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return { ym, key: `lf_acta_seq_${ym}` };
}

// El folio solo avanza al imprimir; abrir y cerrar el acta no consume números.
function gerPeekFolio() {
    const { ym, key } = gerFolioKey();
    let seq = 1;
    try { seq = (parseInt(localStorage.getItem(key) || '0', 10) || 0) + 1; }
    catch { seq = Math.floor(Math.random() * 900) + 100; }
    return `ACTA-DON-${ym}-${String(seq).padStart(3, '0')}`;
}

function gerCommitFolio() {
    const { key } = gerFolioKey();
    try { localStorage.setItem(key, String((parseInt(localStorage.getItem(key) || '0', 10) || 0) + 1)); }
    catch { /* sin almacenamiento disponible: el folio simplemente no avanza */ }
}

function gerUpdateActaEntity() {
    const value = (document.getElementById('actaEntityInput')?.value || '').trim();
    gerSetText('actaEntityName', value || '[Entidad receptora por definir]');
}

function openDonationModal(itemsToInclude = null) {
    const modal = document.getElementById('donationModal');
    if (!modal) return;

    const items = itemsToInclude && itemsToInclude.length > 0 ? itemsToInclude : (window.gerenciaDonationLot || []);

    const now = new Date();
    const folio = gerPeekFolio();
    gerSetText('actaFolio', folio);
    gerSetText('actaFolioFooter', folio);
    gerSetText('actaDate', now.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    gerSetText('actaAuthorizedBy', window.currentUserData?.email || 'Gerencia General de Operaciones');
    gerUpdateActaEntity();

    const tbody = document.getElementById('actaItemsTableBody');
    if (tbody) {
        tbody.innerHTML = items.length === 0
            ? '<tr><td colspan="6" class="p-4 text-center text-xs theme-text-muted">No hay artículos seleccionados para esta acta.</td></tr>'
            : items.map((it, idx) => `
                <tr class="border-b border-slate-100 dark:border-slate-800">
                    <td class="p-2.5 font-mono text-[10px]">${idx + 1}</td>
                    <td class="p-2.5 font-mono font-bold text-[11px]">${escapeHtml(it.pickupCode || it.itemID?.slice(0, 8) || 'S/C')}</td>
                    <td class="p-2.5 font-medium">${escapeHtml(it.title)}</td>
                    <td class="p-2.5">${escapeHtml(it.category)}</td>
                    <td class="p-2.5">${escapeHtml(it.zone)}</td>
                    <td class="p-2.5 text-center font-mono font-bold">${calculateItemDaysInCustody(it)} días</td>
                </tr>`).join('');
    }

    const totalValue = items.reduce((s, i) => s + getCategoryEstimatedValue(i.category), 0);
    gerSetText('actaTotals', items.length
        ? `Total: ${items.length} bien${items.length === 1 ? '' : 'es'} · Valor referencial estimado: ${gerMoney(totalValue)}`
        : '');

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeDonationModal() {
    document.getElementById('donationModal')?.classList.add('hidden');
}

// ----------------------------------------------------------------------------
// Exportación CSV (respeta el período seleccionado)
// ----------------------------------------------------------------------------
function gerCsvCell(value) {
    let s = String(value ?? '');
    // Evita inyección de fórmulas al abrir en Excel
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
}

function gerLegalStatus(item, reserved) {
    if (item.type !== 'FOUND') return 'N/A';
    if (gerIsDelivered(item)) return 'ENTREGADO';
    if (reserved.has(item.itemID)) return 'VALIDADO_PENDIENTE_RETIRO';
    const days = calculateItemDaysInCustody(item);
    if (days >= GER_LEGAL_DAYS) return 'PLAZO_LEGAL_90D';
    if (days >= GER_DONATION_DAYS) return 'DONACION_30D';
    return 'EN_PLAZO';
}

function exportGerenciaCsv() {
    const { current, period } = gerGetScopedData();
    if (current.length === 0) {
        alert('No hay datos disponibles para exportar en el período seleccionado.');
        return;
    }

    const reserved = gerGetReservedFoundIds();
    const headers = ['ID', 'Codigo_Retiro', 'Tipo', 'Titulo', 'Categoria', 'Zona', 'Fecha', 'Hora', 'Estado', 'Estado_Legal', 'Dias_Custodia', 'Valor_Estimado_PEN', 'Reportado_Por'];

    const rows = current.map(i => [
        gerCsvCell(i.itemID),
        gerCsvCell(i.pickupCode),
        gerCsvCell(i.type),
        gerCsvCell(i.title),
        gerCsvCell(i.category),
        gerCsvCell(i.zone),
        gerCsvCell(i.date),
        gerCsvCell(i.time),
        gerCsvCell(i.status),
        gerCsvCell(gerLegalStatus(i, reserved)),
        calculateItemDaysInCustody(i),
        getCategoryEstimatedValue(i.category),
        gerCsvCell(i.createdBy)
    ].join(';'));

    const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const suffix = period === 'ALL' ? 'historico' : period.toLowerCase();
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_gerencial_lost_found_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ----------------------------------------------------------------------------
// Controles del panel (se enlazan una sola vez)
// ----------------------------------------------------------------------------
function gerOpenLotWithFilter(filter) {
    window.gerenciaDonationFilter = filter;
    window.gerenciaSelectedIds.clear();
    renderDonationsTable(window.gerenciaDonationLot || []);
    if (window.lucide) lucide.createIcons();
    document.getElementById('donationsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initGerenciaControls() {
    const view = document.getElementById('gerenciaView');
    if (!view || view.dataset.gerBound === '1') return;
    view.dataset.gerBound = '1';

    document.getElementById('gerenciaPeriodFilter')?.addEventListener('change', () => renderGerenciaDashboard());
    document.getElementById('btnExportCsv')?.addEventListener('click', exportGerenciaCsv);
    document.getElementById('btnOpenDonationModal')?.addEventListener('click', () => openDonationModal());

    document.getElementById('btnGerenciaRefresh')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.classList.add('opacity-60');
        try { await loadData(); }
        finally {
            btn.disabled = false;
            btn.classList.remove('opacity-60');
        }
    });

    document.getElementById('btnCopyInsights')?.addEventListener('click', async () => {
        const label = document.getElementById('btnCopyInsightsLabel');
        try {
            await navigator.clipboard.writeText(window.gerenciaInsightsText || '');
            if (label) label.textContent = '¡Copiado!';
        } catch {
            if (label) label.textContent = 'No se pudo copiar';
        }
        setTimeout(() => { if (label) label.textContent = 'Copiar'; }, 1800);
    });

    // Acciones prioritarias
    document.getElementById('gerenciaAlertsContainer')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ger-action]');
        if (!btn) return;
        const action = btn.dataset.gerAction;
        if (action === 'lot-legal') gerOpenLotWithFilter('D90');
        else if (action === 'lot-donation') gerOpenLotWithFilter('D30');
        else if (action === 'matches' && typeof activateMatchesTab === 'function') activateMatchesTab();
        else if (action === 'pickup' && typeof activateItemsTab === 'function') {
            activateItemsTab();
            const filterValBtn = document.querySelector('.filter-btn[data-filter="VALIDATED"]');
            if (filterValBtn) filterValBtn.click();
            document.getElementById('staffSearchSection')?.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // Filtros de la tabla de donaciones
    document.getElementById('donationFilterChips')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        window.gerenciaDonationFilter = btn.dataset.filter;
        renderDonationsTable(window.gerenciaDonationLot || []);
        if (window.lucide) lucide.createIcons();
    });

    // Selección y acta individual (delegado sobre el cuerpo de la tabla)
    const tbody = document.getElementById('donationsTableBody');
    tbody?.addEventListener('change', (e) => {
        const cb = e.target.closest('.row-check');
        if (!cb) return;
        if (cb.checked) window.gerenciaSelectedIds.add(cb.dataset.itemId);
        else window.gerenciaSelectedIds.delete(cb.dataset.itemId);
        const selectAll = document.getElementById('selectAllDonations');
        if (selectAll) selectAll.checked = gerGetFilteredLot().every(i => window.gerenciaSelectedIds.has(i.itemID));
        gerUpdateLotActaButton();
    });
    tbody?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-single-acta');
        if (!btn) return;
        const single = (window.gerenciaDonationLot || []).filter(i => i.itemID === btn.dataset.itemId);
        openDonationModal(single);
    });

    document.getElementById('selectAllDonations')?.addEventListener('change', (e) => {
        gerGetFilteredLot().forEach(i => {
            if (e.target.checked) window.gerenciaSelectedIds.add(i.itemID);
            else window.gerenciaSelectedIds.delete(i.itemID);
        });
        renderDonationsTable(window.gerenciaDonationLot || []);
    });

    document.getElementById('btnGenerateFullLotActa')?.addEventListener('click', () => {
        const lot = window.gerenciaDonationLot || [];
        const target = window.gerenciaSelectedIds.size > 0
            ? lot.filter(i => window.gerenciaSelectedIds.has(i.itemID))
            : gerGetFilteredLot();
        openDonationModal(target);
    });

    // Modal del acta
    const modal = document.getElementById('donationModal');
    document.getElementById('closeDonationModal')?.addEventListener('click', closeDonationModal);
    document.getElementById('btnCloseDonationModalBtn')?.addEventListener('click', closeDonationModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeDonationModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeDonationModal();
    });
    document.getElementById('actaEntityInput')?.addEventListener('input', gerUpdateActaEntity);
    document.getElementById('btnPrintActa')?.addEventListener('click', () => {
        gerUpdateActaEntity();
        gerCommitFolio();
        window.print();
    });

    // Inicializar cargadores de fotos de firmas digitales
    initSignatureUploaders();
}

function initSignatureUploaders() {
    const configs = [
        { inputId: 'signGerenciaInput', imgId: 'signGerenciaImg', phId: 'signGerenciaPlaceholder', rmId: 'signGerenciaRemove' },
        { inputId: 'signSeguridadInput', imgId: 'signSeguridadImg', phId: 'signSeguridadPlaceholder', rmId: 'signSeguridadRemove' },
        { inputId: 'signEntidadInput', imgId: 'signEntidadImg', phId: 'signEntidadPlaceholder', rmId: 'signEntidadRemove' }
    ];

    configs.forEach(c => {
        const input = document.getElementById(c.inputId);
        const img = document.getElementById(c.imgId);
        const placeholder = document.getElementById(c.phId);
        const rmBtn = document.getElementById(c.rmId);

        if (!input || !img || !placeholder || !rmBtn) return;

        input.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('Por favor selecciona un archivo de imagen (PNG, JPG o WEBP).');
                input.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                img.src = evt.target.result;
                img.classList.remove('hidden');
                rmBtn.classList.remove('hidden');
                placeholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        });

        rmBtn.addEventListener('click', () => {
            input.value = '';
            img.src = '';
            img.classList.add('hidden');
            rmBtn.classList.add('hidden');
            placeholder.classList.remove('hidden');
        });
    });
}

// ============================================================================
// 12. MODAL DE DETALLE & CÓDIGO DE RECOJO (CLIENTE)
// ============================================================================
function showPickupModal(itemId, itemTitle, pickupCode = '') {
    let modal = document.getElementById('pickupModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pickupModal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
        document.body.appendChild(modal);
    }

    const displayCode = pickupCode || 'EN PROCESO';

    modal.innerHTML = `
        <div class="theme-card border rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onclick="closePickupModal()" class="absolute top-4 right-4 theme-text-muted hover:theme-text-primary p-2 text-lg cursor-pointer">
                ✕
            </button>
            <div class="text-center">
                <div class="w-12 h-12 bg-sky-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/20">
                    <span class="text-2xl">🎫</span>
                </div>
                <h3 class="text-xl font-extrabold theme-text-primary font-heading">Pase de Retiro Seguro</h3>
                <p class="text-xs theme-text-muted mt-1">${escapeHtml(itemTitle)}</p>
            </div>

            <!-- Contenedor del Código Alfanumérico -->
            <div class="my-6 text-center">
                <div class="mx-auto p-4 bg-sky-50 dark:bg-slate-900 border-2 border-sky-200 dark:border-sky-800 rounded-2xl shadow-sm inline-block min-w-[200px]">
                    <p class="text-xs theme-text-muted font-bold uppercase mb-1">Tu código de retiro es:</p>
                    <p class="text-3xl font-mono font-extrabold tracking-[4px] text-sky-700 dark:text-sky-400">
                        ${escapeHtml(displayCode)}
                    </p>
                </div>
                <p class="text-[11px] theme-text-muted mt-3 font-medium">Dicta este código al personal de seguridad para validar tu identidad y reclamar tu objeto.</p>
            </div>

            <!-- Recuadro de Instrucciones con Alto Contraste -->
            <div class="bg-sky-50 dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-2xl p-4 text-xs space-y-2.5">
                <div class="flex items-center justify-between">
                    <span class="text-slate-600 dark:text-slate-400 font-medium">📍 Lugar de entrega:</span>
                    <span class="font-bold text-slate-900 dark:text-white">Módulo Central (Piso 1)</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-600 dark:text-slate-400 font-medium">📄 Requisito obligatorio:</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">Documento de Identidad</span>
                </div>
            </div>

            <button onclick="closePickupModal()" class="btn-pill w-full mt-6 py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition-all shadow-md shadow-sky-500/20 cursor-pointer">
                Entendido
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closePickupModal() {
    const modal = document.getElementById('pickupModal');
    if (modal) modal.classList.add('hidden');
}

// ============================================================================
// 12.9. RESET COMPLETO DEL ESTADO TEMPORAL DE MALLBOT
// ============================================================================
function resetMallBotSessionState({ showWelcome = true } = {}) {
    // Memoria temporal de conversación
    window.mallBotHistory = [];
    window.mallBotAttachedPhoto = null;

    // Detener voz si estuviera activa
    if (window.mallBotIsListening && window.mallBotRecognition) {
        try { window.mallBotRecognition.stop(); } catch (e) {}
    }
    window.mallBotIsListening = false;

    // Formulario principal
    const itemForm = document.getElementById('itemForm');
    if (itemForm) itemForm.reset();

    const itemType = document.getElementById('itemType');
    if (itemType) itemType.value = window.currentUserIsStaff ? 'FOUND' : 'LOST';

    // Campos condicionales
    const categoryOtherContainer = document.getElementById('categoryOtherContainer');
    const categoryOtherInput = document.getElementById('categoryOtherInput');
    if (categoryOtherContainer) categoryOtherContainer.classList.add('hidden');
    if (categoryOtherInput) {
        categoryOtherInput.value = '';
        categoryOtherInput.required = false;
    }

    const zoneOtherContainer = document.getElementById('zoneOtherContainer');
    const zoneOtherInput = document.getElementById('zoneOtherInput');
    if (zoneOtherContainer) zoneOtherContainer.classList.add('hidden');
    if (zoneOtherInput) {
        zoneOtherInput.value = '';
        zoneOtherInput.required = false;
    }

    // Foto del formulario
    const mainPhotoInput = document.getElementById('photo');
    if (mainPhotoInput) mainPhotoInput.value = '';

    const mainPhotoPreview = document.getElementById('photoPreview');
    if (mainPhotoPreview) {
        mainPhotoPreview.src = '';
        mainPhotoPreview.classList.add('hidden');
    }
    document.getElementById('photoPlaceholder')?.classList.remove('hidden');

    // Foto del chatbot
    const botPhotoInput = document.getElementById('mallBotPhotoInput');
    if (botPhotoInput) botPhotoInput.value = '';

    const botPhotoThumb = document.getElementById('mallBotPhotoThumb');
    if (botPhotoThumb) botPhotoThumb.src = '';

    const botPhotoName = document.getElementById('mallBotPhotoName');
    if (botPhotoName) botPhotoName.textContent = '';

    document.getElementById('mallBotPhotoBar')?.classList.add('hidden');
    document.getElementById('mallBotSubmitWrap')?.classList.add('hidden');

    // Input del chat
    const botInput = document.getElementById('mallBotInput');
    if (botInput) botInput.value = '';

    // Estado visual
    if (typeof updateMallBotLiveBadges === 'function') {
        updateMallBotLiveBadges(null);
    }

    // La conversación visible también debe desaparecer entre usuarios.
    const messagesContainer = document.getElementById('mallBotMessages');
    if (messagesContainer) {
        messagesContainer.innerHTML = showWelcome
            ? `
                <div class="mallbot-msg mallbot-msg-bot">
                    <p class="font-medium">¡Hola! 👋 Soy <strong>MallBot</strong>, tu asistente de objetos perdidos.</p>
                    <p class="mt-1 text-xs theme-text-secondary">Cuéntame qué objeto perdiste o usa el micrófono 🎙️ para dictarme los detalles. Yo rellenaré tu reporte automáticamente.</p>
                </div>
            `
            : '';
    }

    if (window.lucide) lucide.createIcons();
}

// ============================================================================
// 13. GESTIÓN DE SESIÓN & COGNITO AUTH
// ============================================================================
function showApplication(session) {
    window.activeSession = session;
    const payload = session.getIdToken().decodePayload();
    window.currentUserData = payload;

    const rawGroups = payload['cognito:groups'] || [];
    const groups = normalizeGroups(rawGroups);
    const isStaff = groups.includes('STAFF');
    const isGerencia = groups.includes('GERENCIA') || groups.includes('ADMIN');

    window.currentUserIsStaff = isStaff || isGerencia;
    window.currentUserIsGerencia = isGerencia;

    // Cada inicio/cambio de sesión comienza con MallBot totalmente limpio.
    resetMallBotSessionState({ showWelcome: true });

    // Reset de filtro a "Todos"
    window.currentFilter = 'ALL';
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter === 'ALL') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Actualizar vistas y Navbar para modo autenticado
    document.getElementById('landingView')?.classList.add('hidden');
    document.getElementById('authModal')?.classList.add('hidden');
    document.getElementById('appView')?.classList.remove('hidden');

    document.getElementById('navAuthPublic')?.classList.add('hidden');
    document.getElementById('navAuthLogged')?.classList.remove('hidden');
    // Mantener visible el enlace de registro/reporte en navbar
    document.getElementById('navRegisterLink')?.classList.remove('hidden');

    // Mostrar botón flotante del Asistente MallBot en modo autenticado
    document.getElementById('mallBotFloatingBtn')?.classList.remove('hidden');

    // Headers & Badges
    const userEmailEl = document.getElementById('currentUserEmail');
    if (userEmailEl) userEmailEl.textContent = payload.email || '';

    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
        if (isGerencia) {
            roleBadge.textContent = 'Gerencia & Operaciones';
            roleBadge.className = 'text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full cursor-pointer flex items-center gap-1.5';
            roleBadge.title = 'Rol: Gerencia de Operaciones (Click para ver panel gerencial)';
        } else if (isStaff) {
            roleBadge.textContent = 'Personal de Seguridad (Staff)';
            roleBadge.className = 'text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full';
            roleBadge.title = 'Rol: Personal de Seguridad';
        } else {
            roleBadge.textContent = 'Visitante Registrado';
            roleBadge.className = 'text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 px-3 py-1 rounded-full';
            roleBadge.title = 'Rol: Visitante';
        }
    }

    const formTitle = document.getElementById('formTitle');
    const formHelp = document.getElementById('formHelp');
    const itemType = document.getElementById('itemType');
    const submitBtnText = document.getElementById('submitBtnText');
    const itemsTitle = document.getElementById('itemsTitle');
    const itemsSubtitle = document.getElementById('itemsSubtitle');
    const staffTabs = document.getElementById('staffTabs');
    const staffSearchSection = document.getElementById('staffSearchSection');

    // Herramienta de entrega exclusiva de Staff.
    if (staffSearchSection) {
        staffSearchSection.classList.add('hidden');
    }

    if (isStaff || isGerencia) {
        if (formTitle) formTitle.textContent = isGerencia ? 'Gestión de Objetos' : 'Registrar Objeto Encontrado';
        if (formHelp) formHelp.textContent = 'El personal registra los objetos del centro comercial para iniciar el matching.';
        if (itemType) itemType.value = 'FOUND';
        if (submitBtnText) submitBtnText.textContent = 'Publicar Reporte de Hallazgo';
        if (itemsTitle) itemsTitle.textContent = 'Todos los Reportes Activos';
        if (itemsSubtitle) itemsSubtitle.textContent = 'Inventario general de objetos perdidos y hallazgos en custodia.';
        if (staffTabs) staffTabs.classList.remove('hidden');

        // Si es rol GERENCIA, activar por defecto la pestaña de Gerencia
        if (isGerencia) {
            activateGerenciaTab();
        } else {
            activateItemsTab();
        }
    } else {
        if (formTitle) formTitle.textContent = 'Reportar Objeto Extraviado';
        if (formHelp) formHelp.textContent = 'Describe tu objeto para que nuestro motor de búsqueda lo compare con los hallazgos de seguridad.';
        if (itemType) itemType.value = 'LOST';
        if (submitBtnText) submitBtnText.textContent = 'Enviar Reporte de Pérdida';
        if (itemsTitle) itemsTitle.textContent = 'Mis Reportes Registrados';
        if (itemsSubtitle) itemsSubtitle.textContent = 'Seguimiento en tiempo real del estado de tus pertenencias.';
        if (staffTabs) staffTabs.classList.add('hidden');
        if (staffSearchSection) {
            staffSearchSection.classList.add('hidden');
            const pickupCodeInput = document.getElementById('pickupCodeInput');
            const searchCodeResult = document.getElementById('searchCodeResult');
            if (pickupCodeInput) pickupCodeInput.value = '';
            if (searchCodeResult) {
                searchCodeResult.innerHTML = '';
                searchCodeResult.classList.add('hidden');
            }
        }
        activateItemsTab();
    }

    loadData();
}

function showLanding() {
    // El logout elimina conversación, formulario, foto y estado visual del usuario anterior.
    resetMallBotSessionState({ showWelcome: true });

    window.activeSession = null;
    window.currentUserIsStaff = false;
    window.currentUserIsGerencia = false;
    window.currentUserData = null;
    window.currentItems = [];
    window.currentMatches = [];
    activateItemsTab();
    document.getElementById('donationModal')?.classList.add('hidden');

    // Ocultar Asistente MallBot
    document.getElementById('mallBotFloatingBtn')?.classList.add('hidden');
    document.getElementById('mallBotPanel')?.classList.add('hidden');

    // Limpieza estricta de todos los formularios y credenciales
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.reset();
    const loginEmail = document.getElementById('loginEmail');
    if (loginEmail) loginEmail.value = '';
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) loginPassword.value = '';
    const loginError = document.getElementById('loginError');
    if (loginError) {
        loginError.textContent = '';
        loginError.classList.add('hidden');
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.reset();
    const registerError = document.getElementById('registerError');
    if (registerError) {
        registerError.textContent = '';
        registerError.classList.add('hidden');
    }

    const modalRegisterForm = document.getElementById('modalRegisterForm');
    if (modalRegisterForm) modalRegisterForm.reset();
    const modalRegisterError = document.getElementById('modalRegisterError');
    if (modalRegisterError) {
        modalRegisterError.textContent = '';
        modalRegisterError.classList.add('hidden');
    }

    // Actualizar vistas y Navbar para modo público
    document.getElementById('appView')?.classList.add('hidden');
    document.getElementById('authModal')?.classList.add('hidden');
    document.getElementById('landingView')?.classList.remove('hidden');

    document.getElementById('navAuthPublic')?.classList.remove('hidden');
    document.getElementById('navAuthLogged')?.classList.add('hidden');
    document.getElementById('navRegisterLink')?.classList.remove('hidden');

    // Evitar residuos visuales de controles exclusivos de Staff al cerrar sesión.
    const staffSearchSection = document.getElementById('staffSearchSection');
    if (staffSearchSection) staffSearchSection.classList.add('hidden');
}

// ============================================================================
// 13.5. ASISTENTE VIRTUAL IA (MALLBOT · AMAZON BEDROCK NOVA LITE)
// ============================================================================
window.mallBotHistory = [];
window.mallBotIsListening = false;
window.mallBotRecognition = null;

function toggleMallBot(forceOpen = null) {
    const panel = document.getElementById('mallBotPanel');
    if (!panel) return;
    const shouldOpen = forceOpen !== null ? forceOpen : panel.classList.contains('hidden');
    if (shouldOpen) {
        panel.classList.remove('hidden');
        document.getElementById('mallBotInput')?.focus();
    } else {
        panel.classList.add('hidden');
        if (window.mallBotIsListening && window.mallBotRecognition) {
            window.mallBotRecognition.stop();
        }
    }
}

function appendMallBotMessage(sender, text, isHtml = false) {
    const messagesContainer = document.getElementById('mallBotMessages');
    if (!messagesContainer) return;

    const msgEl = document.createElement('div');
    msgEl.className = `mallbot-msg ${sender === 'user' ? 'mallbot-msg-user' : 'mallbot-msg-bot'}`;
    
    if (isHtml) {
        msgEl.innerHTML = text;
    } else {
        msgEl.textContent = text;
    }

    messagesContainer.appendChild(msgEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    if (window.lucide) lucide.createIcons();
    return msgEl;
}

window.mallBotAttachedPhoto = null;

function mallBotHasRealValue(value) {
    if (value === null || value === undefined) return false;
    const normalized = String(value).trim().toLowerCase();
    return !['', 'null', 'none', 'undefined', 'no definido', 'no definida'].includes(normalized);
}

function updateMallBotLiveBadges(extracted) {
    const badgesContainer = document.getElementById('mallBotStateBadges');
    if (!badgesContainer) return;

    if (!extracted || Object.keys(extracted).length === 0) {
        badgesContainer.innerHTML = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 theme-text-muted">Esperando datos...</span>';
        return;
    }

    const pills = [];
    if (mallBotHasRealValue(extracted.title)) pills.push(`📌 ${escapeHtml(extracted.title)}`);
    if (mallBotHasRealValue(extracted.category)) pills.push(`🏷️ ${escapeHtml(extracted.category)}`);
    if (mallBotHasRealValue(extracted.zone)) pills.push(`📍 ${escapeHtml(extracted.zone)}`);
    if (mallBotHasRealValue(extracted.date)) pills.push(`📅 ${escapeHtml(extracted.date)}`);
    if (mallBotHasRealValue(extracted.time)) pills.push(`⏰ ${escapeHtml(extracted.time)}`);
    if (window.mallBotAttachedPhoto) pills.push(`📷 Foto lista`);

    if (pills.length === 0) {
        badgesContainer.innerHTML = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 theme-text-muted">Analizando...</span>';
    } else {
        badgesContainer.innerHTML = pills.map(p => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300 font-medium whitespace-nowrap">${p}</span>`).join('');
    }
}

function applyMallBotExtractedData(extracted, isComplete) {
    if (!extracted || typeof extracted !== 'object') return;

    // 1. Título
    if (mallBotHasRealValue(extracted.title)) {
        const titleInput = document.getElementById('title');
        if (titleInput) {
            titleInput.value = extracted.title;
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            titleInput.dispatchEvent(new Event('change', { bubbles: true }));
            titleInput.classList.add('field-autofilled');
            setTimeout(() => titleInput.classList.remove('field-autofilled'), 2000);
        }
    }

    // 2. Categoría
    if (mallBotHasRealValue(extracted.category)) {
        const categorySelect = document.getElementById('category');
        const categoryOtherContainer = document.getElementById('categoryOtherContainer');
        const categoryOtherInput = document.getElementById('categoryOtherInput');
        if (categorySelect) {
            const rawCat = String(extracted.category).trim();
            const rawCatLower = rawCat.toLowerCase();
            let matchedIndex = -1;

            for (let i = 0; i < categorySelect.options.length; i++) {
                const optVal = categorySelect.options[i].value;
                if (!optVal || optVal.trim() === '') continue; // Ignorar el placeholder vacío

                const optTextLower = categorySelect.options[i].text.toLowerCase();
                const optValLower = optVal.toLowerCase();

                // Solo comparar opciones estándar (no "Otros")
                if (optValLower !== 'otros') {
                    if (rawCatLower === optValLower || rawCatLower === optTextLower || rawCatLower.includes(optValLower) || optValLower.includes(rawCatLower)) {
                        matchedIndex = i;
                        break;
                    }
                }
            }

            // Mapeo inteligente por palabras clave si no hubo coincidencia estándar
            if (matchedIndex === -1 && rawCatLower !== 'otros') {
                if (rawCatLower.includes('reloj') || rawCatLower.includes('joya') || rawCatLower.includes('anillo') || rawCatLower.includes('collar') || rawCatLower.includes('pulsera')) {
                    matchedIndex = Array.from(categorySelect.options).findIndex(o => o.value.includes('Joyas'));
                } else if (rawCatLower.includes('polo') || rawCatLower.includes('ropa') || rawCatLower.includes('prenda') || rawCatLower.includes('pantalon') || rawCatLower.includes('casaca') || rawCatLower.includes('polera')) {
                    matchedIndex = Array.from(categorySelect.options).findIndex(o => o.value.includes('Prendas'));
                } else if (rawCatLower.includes('celular') || rawCatLower.includes('telefono') || rawCatLower.includes('iphone') || rawCatLower.includes('smartphone') || rawCatLower.includes('tablet')) {
                    matchedIndex = Array.from(categorySelect.options).findIndex(o => o.value.includes('Smartphones'));
                } else if (rawCatLower.includes('billetera') || rawCatLower.includes('cartera') || rawCatLower.includes('tarjeta') || rawCatLower.includes('dni') || rawCatLower.includes('documento')) {
                    matchedIndex = Array.from(categorySelect.options).findIndex(o => o.value.includes('Billeteras'));
                } else if (rawCatLower.includes('mochila') || rawCatLower.includes('bolso') || rawCatLower.includes('morral') || rawCatLower.includes('maleta')) {
                    matchedIndex = Array.from(categorySelect.options).findIndex(o => o.value.includes('Mochilas'));
                } else if (rawCatLower.includes('laptop') || rawCatLower.includes('computadora') || rawCatLower.includes('audifono') || rawCatLower.includes('gadget') || rawCatLower.includes('cargador')) {
                    matchedIndex = Array.from(categorySelect.options).findIndex(o => o.value.includes('Laptops'));
                } else if (rawCatLower.includes('llave') || rawCatLower.includes('llavero')) {
                    matchedIndex = Array.from(categorySelect.options).findIndex(o => o.value.includes('Llaves'));
                }
            }

            if (matchedIndex !== -1 && categorySelect.options[matchedIndex].value !== 'Otros') {
                categorySelect.selectedIndex = matchedIndex;
                if (categoryOtherContainer) categoryOtherContainer.classList.add('hidden');
                if (categoryOtherInput) {
                    categoryOtherInput.required = false;
                    categoryOtherInput.value = '';
                }
            } else {
                // Es "Otros" o una categoría personalizada no estándar
                categorySelect.value = 'Otros';
                if (categoryOtherContainer) categoryOtherContainer.classList.remove('hidden');
                if (categoryOtherInput) {
                    categoryOtherInput.required = true;
                    const customText = (rawCatLower !== 'otros' && rawCatLower !== 'otro') ? rawCat : (extracted.title || categoryOtherInput.value || 'Objeto personalizado');
                    categoryOtherInput.value = customText;
                    categoryOtherInput.dispatchEvent(new Event('input', { bubbles: true }));
                    categoryOtherInput.dispatchEvent(new Event('change', { bubbles: true }));
                    categoryOtherInput.classList.add('field-autofilled');
                    setTimeout(() => categoryOtherInput.classList.remove('field-autofilled'), 2000);
                }
            }

            categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
            categorySelect.classList.add('field-autofilled');
            setTimeout(() => categorySelect.classList.remove('field-autofilled'), 2000);
        }
    }

    // 3. Zona
    if (mallBotHasRealValue(extracted.zone)) {
        const zoneSelect = document.getElementById('zone');
        const zoneOtherContainer = document.getElementById('zoneOtherContainer');
        const zoneOtherInput = document.getElementById('zoneOtherInput');
        if (zoneSelect) {
            const rawZone = String(extracted.zone).trim();
            const rawZoneLower = rawZone.toLowerCase();
            let matchedIndex = -1;

            for (let i = 0; i < zoneSelect.options.length; i++) {
                const optVal = zoneSelect.options[i].value;
                if (!optVal || optVal.trim() === '') continue; // Ignorar placeholder

                const optTextLower = zoneSelect.options[i].text.toLowerCase();
                const optValLower = optVal.toLowerCase();

                if (optValLower !== 'otra zona...') {
                    if (rawZoneLower === optValLower || rawZoneLower === optTextLower || rawZoneLower.includes(optValLower) || optValLower.includes(rawZoneLower)) {
                        matchedIndex = i;
                        break;
                    }
                }
            }

            // Mapeo inteligente por palabras clave
            if (matchedIndex === -1 && rawZoneLower !== 'otra zona...' && rawZoneLower !== 'otra zona') {
                if (rawZoneLower.includes('comida') || rawZoneLower.includes('patio') || rawZoneLower.includes('restaurante') || rawZoneLower.includes('food')) {
                    matchedIndex = Array.from(zoneSelect.options).findIndex(o => o.value.includes('Patio de Comidas'));
                } else if (rawZoneLower.includes('cine') || rawZoneLower.includes('cinemark') || rawZoneLower.includes('cineplanet') || rawZoneLower.includes('pelicula')) {
                    matchedIndex = Array.from(zoneSelect.options).findIndex(o => o.value.includes('Cines'));
                } else if (rawZoneLower.includes('estacionamiento') || rawZoneLower.includes('cochera') || rawZoneLower.includes('s1') || rawZoneLower.includes('s2') || rawZoneLower.includes('auto')) {
                    matchedIndex = Array.from(zoneSelect.options).findIndex(o => o.value.includes('Estacionamiento'));
                } else if (rawZoneLower.includes('bano') || rawZoneLower.includes('baño') || rawZoneLower.includes('sshh') || rawZoneLower.includes('servicio')) {
                    matchedIndex = Array.from(zoneSelect.options).findIndex(o => o.value.includes('Baños'));
                } else if (rawZoneLower.includes('entrada') || rawZoneLower.includes('puerta') || rawZoneLower.includes('ingreso') || rawZoneLower.includes('acceso')) {
                    matchedIndex = Array.from(zoneSelect.options).findIndex(o => o.value.includes('Entrada Principal'));
                } else if (rawZoneLower.includes('departamental') || rawZoneLower.includes('ripley') || rawZoneLower.includes('falabella') || rawZoneLower.includes('oechsle') || rawZoneLower.includes('piso 2')) {
                    matchedIndex = Array.from(zoneSelect.options).findIndex(o => o.value.includes('Departamentales'));
                } else if (rawZoneLower.includes('pasillo') || rawZoneLower.includes('tienda') || rawZoneLower.includes('piso 1')) {
                    matchedIndex = Array.from(zoneSelect.options).findIndex(o => o.value.includes('Pasillo Central'));
                }
            }

            if (matchedIndex !== -1 && zoneSelect.options[matchedIndex].value !== 'Otra Zona...') {
                zoneSelect.selectedIndex = matchedIndex;
                if (zoneOtherContainer) zoneOtherContainer.classList.add('hidden');
                if (zoneOtherInput) {
                    zoneOtherInput.required = false;
                    zoneOtherInput.value = '';
                }
            } else {
                // Es "Otra Zona..." o una ubicación personalizada
                zoneSelect.value = 'Otra Zona...';
                if (zoneOtherContainer) zoneOtherContainer.classList.remove('hidden');
                if (zoneOtherInput) {
                    zoneOtherInput.required = true;
                    const customZoneText = (!rawZoneLower.includes('otra zona')) ? rawZone : (zoneOtherInput.value || 'Zona no especificada');
                    zoneOtherInput.value = customZoneText;
                    zoneOtherInput.dispatchEvent(new Event('input', { bubbles: true }));
                    zoneOtherInput.dispatchEvent(new Event('change', { bubbles: true }));
                    zoneOtherInput.classList.add('field-autofilled');
                    setTimeout(() => zoneOtherInput.classList.remove('field-autofilled'), 2000);
                }
            }

            zoneSelect.dispatchEvent(new Event('change', { bubbles: true }));
            zoneSelect.classList.add('field-autofilled');
            setTimeout(() => zoneSelect.classList.remove('field-autofilled'), 2000);
        }
    }

   // 4. Fecha
    if (
        extracted.date &&
        String(extracted.date).trim() !== '' &&
        String(extracted.date).toLowerCase() !== 'null' &&
        String(extracted.date).toLowerCase() !== 'no definido'
    ) {
        const dateInput = document.getElementById('itemDate');

        if (dateInput) {
            dateInput.value = extracted.date;
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            dateInput.classList.add('field-autofilled');

            setTimeout(() => {
                dateInput.classList.remove('field-autofilled');
            }, 2000);
        }
    }

    // 4.1 Hora Aproximada (Opcional)
    if (
        extracted.time &&
        String(extracted.time).trim() !== '' &&
        String(extracted.time).toLowerCase() !== 'null' &&
        String(extracted.time).toLowerCase() !== 'no definido'
    ) {
        const timeInput = document.getElementById('itemTime');

        if (timeInput) {
            timeInput.value = extracted.time;
            timeInput.dispatchEvent(new Event('input', { bubbles: true }));
            timeInput.dispatchEvent(new Event('change', { bubbles: true }));
            timeInput.classList.add('field-autofilled');

            setTimeout(() => {
                timeInput.classList.remove('field-autofilled');
            }, 2000);
        }
    }

    // 5. Descripción
    if (mallBotHasRealValue(extracted.description)) {
        const descInput = document.getElementById('description');
        if (descInput) {
            descInput.value = extracted.description;
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
            descInput.dispatchEvent(new Event('change', { bubbles: true }));
            descInput.classList.add('field-autofilled');
            setTimeout(() => descInput.classList.remove('field-autofilled'), 2000);
        }
    }

    updateMallBotLiveBadges(extracted);

    // Mostrar barra de guardado si la IA marcó completitud o si hay foto adjunta
    const submitWrap = document.getElementById('mallBotSubmitWrap');
    if (submitWrap) {
        if (isComplete || window.mallBotAttachedPhoto) {
            submitWrap.classList.remove('hidden');
        }
    }
}

async function sendMallBotMessage(userText) {
    const text = (userText || '').trim();
    if (!text) return;

    const input = document.getElementById('mallBotInput');
    const sendBtn = document.getElementById('mallBotSendBtn');
    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;

    // 1. Mostrar mensaje del usuario en el chat
    appendMallBotMessage('user', text);

    // 2. Mostrar indicador de "MallBot está pensando..."
    const loadingMsgEl = appendMallBotMessage('bot', '<span class="lf-ai-spinner mr-2"></span> MallBot está pensando...', true);

    // 3. Recopilar datos actuales del formulario (solo valores no vacíos)
    const categoryEl = document.getElementById('category');
    const zoneEl = document.getElementById('zone');
    const currentData = {
        title: document.getElementById('title')?.value?.trim() || null,
        category: (categoryEl && categoryEl.value && categoryEl.value !== '') ? categoryEl.value : null,
        zone: (zoneEl && zoneEl.value && zoneEl.value !== '') ? zoneEl.value : null,
        date: document.getElementById('itemDate')?.value || null,
        time: document.getElementById('itemTime')?.value || null,
        description: document.getElementById('description')?.value?.trim() || null
    };

    try {
        let token = null;
        try {
            token = getToken();
        } catch (e) {
            console.warn('No hay token activo:', e);
        }

        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = token;
        }

        const separator = CHAT_URL.includes('?') ? '&' : '?';
        const response = await fetch(`${CHAT_URL}${separator}t=${Date.now()}`, {
            method: 'POST',
            cache: 'no-store',
            headers: headers,
            body: JSON.stringify({
                message: text,
                history: window.mallBotHistory,
                currentData: currentData
            })
        });

        const responseText = await response.text();
        let result = {};
        if (responseText) {
            try {
                result = JSON.parse(responseText);
            } catch {
                throw new Error('La API devolvió una respuesta no válida.');
            }
        }

        if (!response.ok) {
            throw new Error(result.message || `Error HTTP ${response.status}`);
        }

        // Si la Lambda devolvió un body stringificado
        if (typeof result.body === 'string') {
            try {
                result = JSON.parse(result.body);
            } catch (e) {}
        }

        // 4. Actualizar historial local
        window.mallBotHistory.push({ role: 'user', text: text });
        if (result.reply) {
            window.mallBotHistory.push({ role: 'assistant', text: result.reply });
        }

        // 5. Reemplazar indicador de carga por la respuesta
        if (loadingMsgEl) {
            let replyHtml = escapeHtml(result.reply || 'He recibido tus datos.');

            // Si el bot está preguntando por la foto o tiene awaitingPhotoChoice
            const isPhotoQuestion = result.awaitingPhotoChoice || (result.reply && (result.reply.includes('foto') || result.reply.includes('fotografía')));
            if (isPhotoQuestion && !window.mallBotAttachedPhoto) {
                replyHtml += `
                    <div class="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <button type="button" class="mallbot-quick-photo-yes px-3 py-1.5 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5">
                            <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                            <span>Sí, subir foto</span>
                        </button>
                        <button type="button" class="mallbot-quick-photo-no px-3 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5">
                            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                            <span>No tengo foto, continuar</span>
                        </button>
                    </div>
                `;
            }

            loadingMsgEl.innerHTML = replyHtml;

            // Escuchar clics en los botones de selección rápida de foto
            const yesBtn = loadingMsgEl.querySelector('.mallbot-quick-photo-yes');
            if (yesBtn) {
                yesBtn.addEventListener('click', () => {
                    const photoInput = document.getElementById('mallBotPhotoInput');
                    if (photoInput) photoInput.click();
                });
            }

            const noBtn = loadingMsgEl.querySelector('.mallbot-quick-photo-no');
            if (noBtn) {
                noBtn.addEventListener('click', () => {
                    document.getElementById('mallBotSubmitWrap')?.classList.remove('hidden');
                    sendMallBotMessage('No tengo foto');
                });
            }
        }

        // 6. Aplicar los campos extraídos al formulario
        applyMallBotExtractedData(result.extracted || {}, result.isComplete || false);

        if (result.isComplete) {
            document.getElementById('mallBotSubmitWrap')?.classList.remove('hidden');
        }

        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error('Error conversando con MallBot:', err);
        if (loadingMsgEl) {
            loadingMsgEl.innerHTML = `<span class="text-rose-500 font-medium">⚠️ Error: ${escapeHtml(err.message)}</span>`;
        }
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        if (input) input.focus();
    }
}

async function submitReportFromMallBot() {
    const autoSubmitBtn = document.getElementById('mallBotAutoSubmitBtn');
    if (!autoSubmitBtn) return;

    const originalHtml = autoSubmitBtn.innerHTML;
    autoSubmitBtn.disabled = true;
    autoSubmitBtn.innerHTML = '<span class="lf-ai-spinner mr-1.5"></span> Registrando en AWS...';

    try {
        let imageUrl = null;
        let photoKey = null;
        const photoFile = window.mallBotAttachedPhoto || document.getElementById('photo')?.files?.[0];

        // 1. Subida a S3 si hay imagen adjunta
        if (photoFile) {
            autoSubmitBtn.innerHTML = '<span class="lf-ai-spinner mr-1.5"></span> Subiendo foto a S3...';
            try {
                const fileMime = photoFile.type || 'image/jpeg';
                const presignedRes = await apiFetch(`${API_BASE_URL}/upload-url`, {
                    method: 'POST',
                    body: JSON.stringify({ fileName: photoFile.name, fileType: fileMime })
                });

                // Manejo de respuesta unificada (directa o encapsulada en body)
                let uploadData = presignedRes;
                if (typeof presignedRes.body === 'string') {
                    try { uploadData = JSON.parse(presignedRes.body); } catch (e) {}
                } else if (presignedRes.body && typeof presignedRes.body === 'object') {
                    uploadData = presignedRes.body;
                }

                const uploadUrl = uploadData.uploadUrl || presignedRes.uploadUrl;
                imageUrl = uploadData.imageUrl || presignedRes.imageUrl;
                photoKey = uploadData.photoKey || presignedRes.photoKey || null;

                if (uploadUrl) {
                    try {
                        const s3Res = await fetch(uploadUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': fileMime },
                            body: photoFile
                        });

                        if (!s3Res.ok) {
                            console.warn('S3 upload HTTP code:', s3Res.status);
                            throw new Error(`Código ${s3Res.status}`);
                        }
                    } catch (fetchErr) {
                        console.warn('Advertencia S3 (revisa CORS en tu bucket S3):', fetchErr);
                        // Permitir continuar el registro en DynamoDB sin interrumpir el flujo
                        imageUrl = imageUrl || null;
                    }
                }
            } catch (s3Err) {
                console.warn('Error subiendo foto:', s3Err);
            }
        }

        autoSubmitBtn.innerHTML = '<span class="lf-ai-spinner mr-1.5"></span> Guardando en DynamoDB...';

        // 2. Resolver Categoría y Zona
        const categorySelect = document.getElementById('category');
        const categoryOtherInput = document.getElementById('categoryOtherInput');
        let finalCategory = categorySelect?.value || 'Otros';
        if (finalCategory === 'Otros' && categoryOtherInput && categoryOtherInput.value.trim()) {
            finalCategory = categoryOtherInput.value.trim();
        }

        const zoneSelect = document.getElementById('zone');
        const zoneOtherInput = document.getElementById('zoneOtherInput');
        let finalZone = zoneSelect?.value || 'Otra Zona...';
        if (finalZone === 'Otra Zona...' && zoneOtherInput && zoneOtherInput.value.trim()) {
            finalZone = zoneOtherInput.value.trim();
        }

        const dateVal = document.getElementById('itemDate')?.value || '';
        const timeVal = document.getElementById('itemTime')?.value || '';
        const finalDate = (dateVal && timeVal) ? `${dateVal} ${timeVal}` : (dateVal || new Date().toISOString().split('T')[0]);

        const titleVal = document.getElementById('title')?.value?.trim() || '';
        const descVal = document.getElementById('description')?.value?.trim() || '';

        if (!titleVal || !finalZone || !dateVal || !descVal) {
            throw new Error('Aún faltan algunos campos requeridos en el formulario.');
        }

        const itemData = {
            type: window.currentUserIsStaff ? 'FOUND' : 'LOST',
            title: titleVal,
            category: finalCategory,
            zone: finalZone,
            date: finalDate,
            description: descVal,
            imageUrl: imageUrl,
            ...(photoKey ? { photoKey } : {})
        };

        const result = await apiFetch(ITEMS_URL, {
            method: 'POST',
            body: JSON.stringify(itemData)
        });

        const matchesCreated = Number(result.matchesCreated || 0);

        // 3. Notificación hermosa dentro del Chat de MallBot
        const successCardHtml = `
            <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-slate-800 dark:text-slate-100 shadow-sm animate-fade-in">
                <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <span class="text-base">🎉</span>
                    <span>¡Reporte Registrado con Éxito!</span>
                </div>
                <p class="text-xs mt-2 theme-text-secondary">
                    Tu objeto <strong>"${escapeHtml(itemData.title)}"</strong> ha sido guardado en <strong>Amazon DynamoDB</strong>.
                </p>
                <div class="mt-2 text-[11px] p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                    <p>📍 <strong>Ubicación:</strong> ${escapeHtml(itemData.zone)}</p>
                    <p>📅 <strong>Fecha/Hora:</strong> ${escapeHtml(itemData.date)}</p>
                    <p>🏷️ <strong>Categoría:</strong> ${escapeHtml(itemData.category)}</p>
                    ${imageUrl ? '<p class="text-sky-600 dark:text-sky-400">📷 <strong>Foto:</strong> Vinculada para análisis visual</p>' : ''}
                </div>
                <p class="text-[11px] text-sky-600 dark:text-sky-300 font-medium mt-2">
                    ${matchesCreated > 0 ? `✨ Amazon Bedrock detectó <strong>${matchesCreated} coincidencia(s)</strong> en revisión.` : '🔍 El motor de IA buscará coincidencias con los hallazgos de seguridad.'}
                </p>
            </div>
        `;
        appendMallBotMessage('bot', successCardHtml, true);

        // 4. Limpieza del formulario y reseteo
        const itemForm = document.getElementById('itemForm');
        if (itemForm) itemForm.reset();
        document.getElementById('categoryOtherContainer')?.classList.add('hidden');
        document.getElementById('zoneOtherContainer')?.classList.add('hidden');
        document.getElementById('photoPreview')?.classList.add('hidden');
        document.getElementById('photoPlaceholder')?.classList.remove('hidden');

        // Limpiar foto en el bot
        window.mallBotAttachedPhoto = null;
        document.getElementById('mallBotPhotoBar')?.classList.add('hidden');
        document.getElementById('mallBotSubmitWrap')?.classList.add('hidden');
        updateMallBotLiveBadges(null);
        window.mallBotHistory = [];

        await loadData();

    } catch (err) {
        console.error('Error guardando desde MallBot:', err);
        appendMallBotMessage('bot', `<span class="text-rose-500 font-medium">⚠️ No se pudo completar el reporte: ${escapeHtml(err.message)}</span>`, true);
    } finally {
        autoSubmitBtn.disabled = false;
        autoSubmitBtn.innerHTML = originalHtml;
        if (window.lucide) lucide.createIcons();
    }
}

function initMallBot() {
    const floatingBtn = document.getElementById('mallBotFloatingBtn');
    const closeBtn = document.getElementById('mallBotCloseBtn');
    const clearBtn = document.getElementById('mallBotClearBtn');
    const form = document.getElementById('mallBotForm');
    const voiceBtn = document.getElementById('mallBotVoiceBtn');
    const voiceStatus = document.getElementById('mallBotVoiceStatus');
    const autoSubmitBtn = document.getElementById('mallBotAutoSubmitBtn');
    const photoBtn = document.getElementById('mallBotPhotoBtn');
    const photoInput = document.getElementById('mallBotPhotoInput');
    const photoBar = document.getElementById('mallBotPhotoBar');
    const photoThumb = document.getElementById('mallBotPhotoThumb');
    const photoName = document.getElementById('mallBotPhotoName');
    const removePhotoBtn = document.getElementById('mallBotRemovePhotoBtn');

    if (floatingBtn) {
        floatingBtn.addEventListener('click', () => toggleMallBot());
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleMallBot(false));
    }

    // 📷 Botón de Subir Foto dentro del Chat
    if (photoBtn && photoInput) {
        photoBtn.addEventListener('click', () => {
            photoInput.click();
        });

        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);
            if (!isImage || file.size > 5 * 1024 * 1024) {
                appendMallBotMessage('bot', '⚠️ Por favor selecciona una imagen (JPG, PNG o WEBP) de hasta 5 MB.');
                photoInput.value = '';
                return;
            }

            window.mallBotAttachedPhoto = file;

            // Sincronizar con el input del formulario principal
            const mainPhotoPreview = document.getElementById('photoPreview');
            const mainPhotoPlaceholder = document.getElementById('photoPlaceholder');

            const reader = new FileReader();
            reader.onload = function(evt) {
                if (photoThumb) photoThumb.src = evt.target.result;
                if (photoName) photoName.textContent = file.name;
                if (photoBar) photoBar.classList.remove('hidden');

                if (mainPhotoPreview) {
                    mainPhotoPreview.src = evt.target.result;
                    mainPhotoPreview.classList.remove('hidden');
                }
                if (mainPhotoPlaceholder) mainPhotoPlaceholder.classList.add('hidden');

                // Mensaje en chat
                appendMallBotMessage('bot', `📷 **Fotografía adjuntada:** *${escapeHtml(file.name)}*<br><span class="text-[11px] theme-text-secondary">Lista para que Amazon Bedrock realice el análisis de similitud visual.</span>`, true);
                
                // Actualizar badges
                const curData = {
                    title: document.getElementById('title')?.value?.trim() || null,
                    category: document.getElementById('category')?.value || null,
                    zone: document.getElementById('zone')?.value || null,
                    date: document.getElementById('itemDate')?.value || null,
                    time: document.getElementById('itemTime')?.value || null
                };
                updateMallBotLiveBadges(curData);

                // Mostrar botón Guardar Reporte
                document.getElementById('mallBotSubmitWrap')?.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        });
    }

    if (removePhotoBtn) {
        removePhotoBtn.addEventListener('click', () => {
            window.mallBotAttachedPhoto = null;
            if (photoInput) photoInput.value = '';
            if (photoBar) photoBar.classList.add('hidden');
            const mainPhotoPreview = document.getElementById('photoPreview');
            const mainPhotoPlaceholder = document.getElementById('photoPlaceholder');
            if (mainPhotoPreview) {
                mainPhotoPreview.src = '';
                mainPhotoPreview.classList.add('hidden');
            }
            if (mainPhotoPlaceholder) mainPhotoPlaceholder.classList.remove('hidden');
            appendMallBotMessage('bot', '🗑️ Fotografía retirada del reporte.');
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            resetMallBotSessionState({ showWelcome: true });
        });
    }

    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const input = document.getElementById('mallBotInput');
            if (input && input.value.trim()) {
                sendMallBotMessage(input.value.trim());
            }
        });
    }

    // Sugerencias Rápidas
    document.querySelectorAll('.mallbot-pill').forEach(pill => {
        pill.addEventListener('click', function() {
            const promptText = this.dataset.quick || this.textContent.trim();
            sendMallBotMessage(promptText);
        });
    });

    // Guardado directo y hermoso desde el bot
    if (autoSubmitBtn) {
        autoSubmitBtn.addEventListener('click', () => {
            submitReportFromMallBot();
        });
    }

    // 🎙️ Configuración de Web Speech API (Voz a Texto nativa y gratuita)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        let recognition = null;
        let finalSpokenText = '';

        function getOrCreateRecognition() {
            if (recognition) return recognition;
            recognition = new SpeechRecognition();
            recognition.lang = 'es-PE';
            recognition.continuous = false;
            recognition.interimResults = true;

            recognition.onstart = function() {
                window.mallBotIsListening = true;
                finalSpokenText = '';
                if (voiceBtn) voiceBtn.classList.add('mallbot-voice-pulse');
                if (voiceStatus) {
                    voiceStatus.textContent = '🎙️ Escuchando... Habla ahora hacia tu micrófono';
                    voiceStatus.classList.remove('hidden');
                }
            };

            recognition.onresult = function(event) {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalSpokenText += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                const input = document.getElementById('mallBotInput');
                if (input) {
                    input.value = finalSpokenText || interimTranscript;
                }
            };

            recognition.onerror = function(event) {
                console.warn('Speech recognition error:', event.error);
                window.mallBotIsListening = false;
                if (voiceBtn) voiceBtn.classList.remove('mallbot-voice-pulse');
                if (voiceStatus) {
                    if (event.error === 'not-allowed') {
                        voiceStatus.textContent = '⚠️ Permiso de micrófono denegado en el navegador.';
                        voiceStatus.classList.remove('hidden');
                    } else {
                        voiceStatus.classList.add('hidden');
                    }
                }
            };

            recognition.onend = function() {
                window.mallBotIsListening = false;
                if (voiceBtn) voiceBtn.classList.remove('mallbot-voice-pulse');
                if (voiceStatus) voiceStatus.classList.add('hidden');

                const input = document.getElementById('mallBotInput');
                const textToSend = (finalSpokenText || input?.value || '').trim();
                if (textToSend.length >= 2) {
                    sendMallBotMessage(textToSend);
                }
            };

            return recognition;
        }

        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                const rec = getOrCreateRecognition();
                if (window.mallBotIsListening) {
                    try { rec.stop(); } catch (e) {}
                } else {
                    try {
                        rec.start();
                    } catch (e) {
                        console.error('Error iniciando micrófono:', e);
                        try { rec.stop(); } catch (ex) {}
                        setTimeout(() => {
                            try { rec.start(); } catch (ex2) {}
                        }, 250);
                    }
                }
            });
        }
    } else {
        if (voiceBtn) {
            voiceBtn.title = 'Reconocimiento de voz no soportado en este navegador.';
            voiceBtn.classList.add('opacity-40');
            voiceBtn.addEventListener('click', () => {
                alert('El reconocimiento de voz por Web Speech API no está soportado en este navegador. Puedes escribir en el cuadro de texto.');
            });
        }
    }
}

// ============================================================================
// 13.1. RESTAURACIÓN DE SESIÓN (PERSISTENCIA AL RECARGAR PÁGINA)
// ============================================================================
function checkActiveSession() {
    try {
        const currentUser = userPool.getCurrentUser();
        if (currentUser) {
            currentUser.getSession((err, session) => {
                if (err || !session || !session.isValid()) {
                    console.warn('Sesión no válida o expirada en Cognito:', err);
                    showLanding();
                } else {
                    console.log('Sesión activa restaurada para:', currentUser.getUsername());
                    showApplication(session);
                }
            });
        } else {
            showLanding();
        }
    } catch (e) {
        console.warn('Error verificando sesión previa:', e);
        showLanding();
    }
}

// ============================================================================
// 14. INICIALIZACIÓN DE FORMULARIOS Y EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // 0. Sanitizadores en tiempo real para inputs estrictos
    function attachInputSanitizer(id, type) {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', e => {
            if (type === 'letters') {
                // Solo letras (incluye acentos, ñ/Ñ) y espacios
                e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
            } else if (type === 'dni') {
                // Solo números, máx 8 dígitos
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
            } else if (type === 'phone') {
                // Solo números, máx 9 dígitos
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
            }
        });
    }

    attachInputSanitizer('regName', 'letters');
    attachInputSanitizer('modalRegName', 'letters');
    attachInputSanitizer('regDni', 'dni');
    attachInputSanitizer('modalRegDni', 'dni');
    attachInputSanitizer('regPhone', 'phone');
    attachInputSanitizer('modalRegPhone', 'phone');

    // 0.1. Navegación fluida del Navbar preservando la sesión
    document.querySelectorAll('.nav-link-anchor').forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);

                if (targetId === 'register' && window.activeSession) {
                    // Si ya está logueado y hace clic en Registro, llevar a Mi Portal y enfocar el formulario
                    document.getElementById('landingView')?.classList.add('hidden');
                    document.getElementById('appView')?.classList.remove('hidden');
                    const itemFormEl = document.getElementById('itemForm');
                    if (itemFormEl) {
                        itemFormEl.scrollIntoView({ behavior: 'smooth' });
                        document.getElementById('title')?.focus();
                    }
                    return;
                }

                // Permitir ver las secciones públicas del mall sin cerrar la sesión
                document.getElementById('landingView')?.classList.remove('hidden');
                document.getElementById('appView')?.classList.add('hidden');

                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    const navPortalBtn = document.getElementById('navPortalBtn');
    if (navPortalBtn) {
        navPortalBtn.addEventListener('click', () => {
            if (window.activeSession) {
                document.getElementById('landingView')?.classList.add('hidden');
                document.getElementById('appView')?.classList.remove('hidden');
                loadData();
            }
        });
    }

    const navLogoutBtn = document.getElementById('navLogoutBtn');
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', () => {
            const currentUser = userPool.getCurrentUser();
            if (currentUser) currentUser.signOut();
            showLanding();
        });
    }

    // Visor de fotos modal (delegación de eventos)
    document.addEventListener('click', event => {
        const trigger = event.target.closest('.lf-photo-trigger');
        if (trigger) openPhotoViewer(trigger.dataset.photoUrl, trigger.dataset.photoTitle);
        if (event.target.closest('[data-close-photo]')) closePhotoViewer();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePhotoViewer();
    });

    // Polling en segundo plano para análisis pendientes de Amazon Nova Lite
    window.setInterval(() => {
        if (!window.activeSession) return;
        if (!window.currentMatches.some(m => String(m.visualStatus).toUpperCase() === 'PENDING')) return;
        
        if (window.lfRefreshingNova) return;
        window.lfRefreshingNova = true;
        
        apiFetch(MATCHES_URL, {method: 'GET'})
            .then(result => {
                window.currentMatches = Array.isArray(result.matches) ? result.matches : [];
                renderItems();
                if (window.currentUserIsStaff) {
                    renderStaffMatches();
                }
            })
            .catch(error => console.warn('Nova refresh:', error))
            .finally(() => { window.lfRefreshingNova = false; });
    }, 10000);

    // 1. Modales y Botones de Autenticación
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const toggleToRegister = document.getElementById('toggleToRegister');
    const toggleToLogin = document.getElementById('toggleToLogin');
    const toggleVerifyToLogin = document.getElementById('toggleVerifyToLogin');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const verifyTab = document.getElementById('verifyTab');
    const verifyEmailInput = document.getElementById('verifyEmail');
    const verifyEmailDisplay = document.getElementById('verifyEmailDisplay');
    const verifyCodeInput = document.getElementById('verifyCode');
    const verifyError = document.getElementById('verifyError');
    const verifySubmit = document.getElementById('verifySubmit');
    const resendCodeBtn = document.getElementById('resendCodeBtn');

    function openModal(mode = 'login', emailForVerification = '') {
        if (!authModal) return;
        authModal.classList.remove('hidden');
        loginTab?.classList.add('hidden');
        registerTab?.classList.add('hidden');
        verifyTab?.classList.add('hidden');

        if (mode === 'register') {
            registerTab?.classList.remove('hidden');
        } else if (mode === 'verify') {
            verifyTab?.classList.remove('hidden');
            if (emailForVerification) {
                if (verifyEmailInput) verifyEmailInput.value = emailForVerification;
                if (verifyEmailDisplay) verifyEmailDisplay.textContent = emailForVerification;
            }
            if (verifyCodeInput) {
                verifyCodeInput.value = '';
                verifyCodeInput.focus();
            }
            if (verifyError) verifyError.classList.add('hidden');
        } else {
            loginTab?.classList.remove('hidden');
        }
    }

    // Botones de Iniciar Sesión (Abren Modal en modo Login)
    document.querySelectorAll('.openLoginBtn').forEach(btn => {
        btn.addEventListener('click', () => openModal('login'));
    });

    // Botones de Reportar / Registrarse (Scroll a la sección de registro)
    document.querySelectorAll('.openRegisterBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const registerSection = document.getElementById('register');
            if (registerSection && document.getElementById('appView').classList.contains('hidden')) {
                registerSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                openModal('register');
            }
        });
    });

    if (closeAuthModal) closeAuthModal.addEventListener('click', () => authModal?.classList.add('hidden'));
    if (toggleToRegister) toggleToRegister.addEventListener('click', () => openModal('register'));
    if (toggleToLogin) toggleToLogin.addEventListener('click', () => openModal('login'));
    if (toggleVerifyToLogin) toggleVerifyToLogin.addEventListener('click', () => openModal('login'));

    // 2. Formulario de Inicio de Sesión
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginSubmit = document.getElementById('loginSubmit');

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (loginError) loginError.classList.add('hidden');
            if (loginSubmit) {
                loginSubmit.disabled = true;
                loginSubmit.textContent = 'Iniciando sesión...';
            }

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
                Username: email,
                Password: password
            });

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: email,
                Pool: userPool
            });

            cognitoUser.authenticateUser(authDetails, {
                onSuccess: function(session) {
                    if (loginSubmit) {
                        loginSubmit.disabled = false;
                        loginSubmit.textContent = 'Iniciar Sesión';
                    }
                    showApplication(session);
                },
                newPasswordRequired: function() {
                    const newPassword = window.prompt('Tu contraseña es temporal. Por favor ingresa una nueva contraseña:');
                    if (!newPassword) {
                        if (loginError) {
                            loginError.textContent = 'Debes ingresar una nueva contraseña.';
                            loginError.classList.remove('hidden');
                        }
                        if (loginSubmit) {
                            loginSubmit.disabled = false;
                            loginSubmit.textContent = 'Iniciar Sesión';
                        }
                        return;
                    }
                    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
                        onSuccess: function(session) {
                            if (loginSubmit) {
                                loginSubmit.disabled = false;
                                loginSubmit.textContent = 'Iniciar Sesión';
                            }
                            showApplication(session);
                        },
                        onFailure: function(err) {
                            console.error(err);
                            if (loginError) {
                                loginError.textContent = translateCognitoError(err);
                                loginError.classList.remove('hidden');
                            }
                            if (loginSubmit) {
                                loginSubmit.disabled = false;
                                loginSubmit.textContent = 'Iniciar Sesión';
                            }
                        }
                    });
                },
                onFailure: function(err) {
                    console.error('Login failure:', err);
                    if (loginSubmit) {
                        loginSubmit.disabled = false;
                        loginSubmit.textContent = 'Iniciar Sesión';
                    }

                    // Si el usuario no ha verificado su correo con el código de 6 dígitos
                    if (err.name === 'UserNotConfirmedException' || err.code === 'UserNotConfirmedException') {
                        openModal('verify', email);
                        if (verifyError) {
                            verifyError.textContent = 'Tu cuenta aún no ha sido activada. Ingresa el código de 6 dígitos que AWS envió a tu correo.';
                            verifyError.classList.remove('hidden');
                        }
                        return;
                    }

                    if (loginError) {
                        loginError.textContent = translateCognitoError(err);
                        loginError.classList.remove('hidden');
                    }
                }
            });
        });
    }

    // 3. Formulario de Registro de Visitantes (Página Principal & Modal)
    function handleRegisterSubmit(formId, errorId, submitBtnId) {
        const form = document.getElementById(formId);
        const errorEl = document.getElementById(errorId);
        const submitBtn = document.getElementById(submitBtnId);
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (errorEl) errorEl.classList.add('hidden');

            const prefix = formId === 'modalRegisterForm' ? 'modalReg' : 'reg';
            const name = document.getElementById(`${prefix}Name`).value.trim();
            const email = document.getElementById(`${prefix}Email`).value.trim();
            const dni = document.getElementById(`${prefix}Dni`).value.trim();
            const phone = document.getElementById(`${prefix}Phone`).value.trim();
            const password = document.getElementById(`${prefix}Password`).value;

            // Validaciones locales antes de llamar a AWS
            if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(name)) {
                if (errorEl) {
                    errorEl.textContent = 'El nombre solo debe contener letras y espacios.';
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            if (!/^\d{8}$/.test(dni)) {
                if (errorEl) {
                    errorEl.textContent = 'El DNI debe tener exactamente 8 dígitos numéricos.';
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            if (!/^\d{9}$/.test(phone)) {
                if (errorEl) {
                    errorEl.textContent = 'El teléfono debe tener exactamente 9 dígitos numéricos.';
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            if (password.length < 8) {
                if (errorEl) {
                    errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres, 1 mayúscula, 1 número y 1 símbolo especial (!@#$%).';
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creando cuenta...';
            }

            const attributeList = [
                new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),
                new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email })
            ];

            userPool.signUp(email, password, attributeList, null, function(err, result) {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Crear Cuenta y Continuar';
                }
                if (err) {
                    console.error('Sign up error:', err);
                    if (errorEl) {
                        errorEl.textContent = translateCognitoError(err);
                        errorEl.classList.remove('hidden');
                    }
                    return;
                }

                // Limpiar formulario y pasar a la pantalla de verificación de 6 dígitos
                form.reset();
                openModal('verify', email);
            });
        });
    }

    handleRegisterSubmit('registerForm', 'registerError', 'registerSubmit');
    handleRegisterSubmit('modalRegisterForm', 'modalRegisterError', 'modalRegisterSubmit');

    // 3.1. Formulario de Verificación de Código (Amazon Cognito)
    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm) {
        verifyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (verifyError) verifyError.classList.add('hidden');

            const email = (verifyEmailInput?.value || '').trim();
            const code = (verifyCodeInput?.value || '').trim();

            if (!email) {
                if (verifyError) {
                    verifyError.textContent = 'No se encontró el correo a verificar. Vuelve al inicio de sesión.';
                    verifyError.classList.remove('hidden');
                }
                return;
            }

            if (!code || code.length !== 6) {
                if (verifyError) {
                    verifyError.textContent = 'Por favor ingresa los 6 dígitos del código.';
                    verifyError.classList.remove('hidden');
                }
                return;
            }

            if (verifySubmit) {
                verifySubmit.disabled = true;
                verifySubmit.textContent = 'Verificando código...';
            }

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: email,
                Pool: userPool
            });

            cognitoUser.confirmRegistration(code, true, function(err, result) {
                if (verifySubmit) {
                    verifySubmit.disabled = false;
                    verifySubmit.textContent = 'Confirmar y Activar Cuenta';
                }

                if (err) {
                    console.error('Error confirmRegistration:', err);
                    if (verifyError) {
                        verifyError.textContent = translateCognitoError(err);
                        verifyError.classList.remove('hidden');
                    }
                    return;
                }

                alert('✓ ¡Cuenta activada con éxito en AWS Cognito!\n\nYa puedes iniciar sesión con tu correo y contraseña.');
                const loginEmailInput = document.getElementById('loginEmail');
                if (loginEmailInput) loginEmailInput.value = email;
                openModal('login');
            });
        });
    }

    // 3.2. Reenvío de código de confirmación
    if (resendCodeBtn) {
        resendCodeBtn.addEventListener('click', function() {
            const email = (verifyEmailInput?.value || '').trim();
            if (!email) {
                alert('No se pudo identificar el correo para el reenvío.');
                return;
            }

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: email,
                Pool: userPool
            });

            resendCodeBtn.disabled = true;
            resendCodeBtn.textContent = 'Enviando...';

            cognitoUser.resendConfirmationCode(function(err, result) {
                resendCodeBtn.disabled = false;
                resendCodeBtn.textContent = 'Reenviar código';

                if (err) {
                    console.error('Error resendConfirmationCode:', err);
                    if (verifyError) {
                        verifyError.textContent = translateCognitoError(err);
                        verifyError.classList.remove('hidden');
                    }
                } else {
                    alert(`✓ Se ha enviado un nuevo código de 6 dígitos a ${email}`);
                }
            });
        });
    }

    // 4. Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            const currentUser = userPool.getCurrentUser();
            if (currentUser) currentUser.signOut();
            showLanding();
        });
    }

    // 5. Categoría y Zona "Otros" (Campos condicionales)
    const categorySelect = document.getElementById('category');
    const categoryOtherContainer = document.getElementById('categoryOtherContainer');
    const categoryOtherInput = document.getElementById('categoryOtherInput');

    if (categorySelect && categoryOtherContainer) {
        categorySelect.addEventListener('change', function() {
            if (this.value === 'Otros') {
                categoryOtherContainer.classList.remove('hidden');
                categoryOtherInput.required = true;
                categoryOtherInput.focus();
            } else {
                categoryOtherContainer.classList.add('hidden');
                categoryOtherInput.required = false;
                categoryOtherInput.value = '';
            }
        });
    }

    const zoneSelect = document.getElementById('zone');
    const zoneOtherContainer = document.getElementById('zoneOtherContainer');
    const zoneOtherInput = document.getElementById('zoneOtherInput');

    if (zoneSelect && zoneOtherContainer) {
        zoneSelect.addEventListener('change', function() {
            if (this.value === 'Otra Zona...') {
                zoneOtherContainer.classList.remove('hidden');
                zoneOtherInput.required = true;
                zoneOtherInput.focus();
            } else {
                zoneOtherContainer.classList.add('hidden');
                zoneOtherInput.required = false;
                zoneOtherInput.value = '';
            }
        });
    }

// 6. Filtros de Estado para Reportes (Iluminación limpia & Alto Contraste)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            window.currentFilter = this.dataset.filter || 'ALL';
            
            // Mantener visible el buscador de entrega para Staff
            const searchSection = document.getElementById('staffSearchSection');
            if (searchSection && window.currentUserIsStaff) {
                searchSection.classList.remove('hidden');
            }

            renderItems();
        });
    });

    // 7. Delegación de Eventos para Botones de Staff (Validar / Descartar)
    const matchesGrid = document.getElementById('matchesGrid');
    if (matchesGrid) {
        matchesGrid.addEventListener('click', async function(e) {
            // Validar Match
            const validateBtn = e.target.closest('.validateMatchBtn');
            if (validateBtn) {
                const matchID = validateBtn.dataset.matchId;
                if (!matchID) return;

                const confirmed = window.confirm(
                    '¿Confirmas la validez de este reclamo?\n\n' +
                    '• El reporte del cliente se marcará como VALIDADO.\n' +
                    '• Se enviará un aviso de notificación por Amazon SNS.'
                );
                if (!confirmed) return;

                const originalText = validateBtn.innerHTML;
                validateBtn.disabled = true;
                validateBtn.innerHTML = 'Validando...';

                try {
                    const validateUrl = `${MATCHES_URL}/${encodeURIComponent(matchID)}/validate`;
                    await apiFetch(validateUrl, {
                        method: 'PATCH',
                        body: JSON.stringify({})
                    });

                    alert('✓ Coincidencia validada con éxito. Correo de notificación enviado.');
                    await loadData();
                    renderStaffMatches();
                } catch (error) {
                    console.error('Error validando match:', error);
                    alert('No se pudo validar: ' + error.message);
                    validateBtn.disabled = false;
                    validateBtn.innerHTML = originalText;
                }
                return;
            }

            // Descartar Match
            const rejectBtn = e.target.closest('.rejectMatchBtn');
            if (rejectBtn) {
                const matchID = rejectBtn.dataset.matchId;
                if (!matchID) return;

                const confirmed = window.confirm('¿Descartar esta coincidencia?');
                if (!confirmed) return;

                try {
                    const validateUrl = `${MATCHES_URL}/${encodeURIComponent(matchID)}/validate`;
                    await apiFetch(validateUrl, {
                        method: 'PATCH',
                        body: JSON.stringify({ action: 'REJECT' })
                    });

                    alert('✕ Coincidencia descartada.');
                    await loadData();
                    renderStaffMatches();
                } catch (error) {
                    console.error('Error descartando:', error);
                    alert('Error al descartar: ' + error.message);
                }
                return;
            }
        });
    }

    // 8. Vista previa de foto
    const photoInput = document.getElementById('photo');
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    const photoPreview = document.getElementById('photoPreview');

    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 4 * 1024 * 1024) {
                    alert('Selecciona una imagen JPG o PNG de hasta 4 MB.');
                    photoInput.value = '';
                    photoPreview.classList.add('hidden');
                    photoPlaceholder.classList.remove('hidden');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(evt) {
                    photoPreview.src = evt.target.result;
                    photoPreview.classList.remove('hidden');
                    photoPlaceholder.classList.add('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                photoPreview.classList.add('hidden');
                photoPlaceholder.classList.remove('hidden');
                photoPreview.src = '';
            }
        });
    }

    // 9. Formulario de Creación de Reportes (Items)
    const itemForm = document.getElementById('itemForm');
    if (itemForm) {
        itemForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            const oldContent = submitBtn.innerHTML;
            submitBtn.disabled = true;

            try {
                let imageUrl = null;
                const file = photoInput?.files?.[0];
                let photoKey = null;

                if (file) {
                    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Selecciona una fotografía JPG o PNG.');
                    if (file.size > 4 * 1024 * 1024) throw new Error('La imagen debe pesar como máximo 4 MB.');
                    submitBtn.innerHTML = 'Subiendo imagen a S3...';
                    const presignedRes = await apiFetch(`${API_BASE_URL}/upload-url`, {
                        method: 'POST',
                        body: JSON.stringify({ fileName: file.name, fileType: file.type })
                    });

                    const s3Res = await fetch(presignedRes.uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': file.type },
                        body: file
                    });
                    if (!s3Res.ok) throw new Error('Error al subir imagen a Amazon S3');
                    imageUrl = presignedRes.imageUrl;
                    photoKey = presignedRes.photoKey || null;
                }

                submitBtn.innerHTML = 'Guardando reporte y analizando...';

                // Resolver Categoría y Zona considerando "Otros"
                let finalCategory = categorySelect.value;
                if (finalCategory === 'Otros' && categoryOtherInput && categoryOtherInput.value.trim()) {
                    finalCategory = categoryOtherInput.value.trim();
                }

                let finalZone = zoneSelect.value;
                if (finalZone === 'Otra Zona...' && zoneOtherInput && zoneOtherInput.value.trim()) {
                    finalZone = zoneOtherInput.value.trim();
                }

                const itemData = {
                    type: window.currentUserIsStaff ? 'FOUND' : 'LOST',
                    title: document.getElementById('title').value.trim(),
                    category: finalCategory,
                    zone: finalZone,
                    date: document.getElementById('itemDate').value,
                    description: document.getElementById('description').value.trim(),
                    imageUrl: imageUrl,
                    ...(photoKey ? { photoKey } : {})
                };

                if (!itemData.title || !itemData.zone || !itemData.date || !itemData.description) {
                    throw new Error('Por favor completa todos los campos requeridos.');
                }

                const result = await apiFetch(ITEMS_URL, {
                    method: 'POST',
                    body: JSON.stringify(itemData)
                });

                const matchesCreated = Number(result.matchesCreated || 0);
                if (matchesCreated > 0) {
                    alert(`✓ Reporte registrado exitosamente. Se generaron ${matchesCreated} coincidencia(s) para análisis.`);
                } else {
                    alert('✓ Reporte registrado correctamente.');
                }

                itemForm.reset();
                if (categoryOtherContainer) categoryOtherContainer.classList.add('hidden');
                if (zoneOtherContainer) zoneOtherContainer.classList.add('hidden');
                if (photoPreview) photoPreview.classList.add('hidden');
                if (photoPlaceholder) photoPlaceholder.classList.remove('hidden');
                document.getElementById('itemType').value = window.currentUserIsStaff ? 'FOUND' : 'LOST';

                await loadData();
            } catch (err) {
                console.error('Error guardando item:', err);
                alert(err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = oldContent;
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // 10. Pestañas de Staff & Gerencia (Items vs Matches vs Gerencia)
    const tabItems = document.getElementById('tabItems');
    const tabMatches = document.getElementById('tabMatches');
    const tabGerencia = document.getElementById('tabGerencia');

    if (tabItems) tabItems.addEventListener('click', activateItemsTab);
    if (tabMatches) tabMatches.addEventListener('click', activateMatchesTab);
    if (tabGerencia) tabGerencia.addEventListener('click', activateGerenciaTab);

    // Controles del Panel de Gerencia (filtros, tabla, acta, CSV)
    initGerenciaControls();

    // RoleBadge click para acceso directo a Gerencia
    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
        roleBadge.addEventListener('click', () => {
            if (window.currentUserIsGerencia || window.currentUserIsStaff) {
                activateGerenciaTab();
            }
        });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadData());
    }

// =======================================================================
    // 10.5 LÓGICA DE BÚSQUEDA Y ENTREGA POR CÓDIGO (SOLO STAFF)
    // =======================================================================
    const searchCodeBtn = document.getElementById('searchCodeBtn');
    const pickupCodeInput = document.getElementById('pickupCodeInput');
    const searchCodeResult = document.getElementById('searchCodeResult');

    if (searchCodeBtn && pickupCodeInput && searchCodeResult) {
        pickupCodeInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                searchCodeBtn.click();
            }
        });

        searchCodeBtn.addEventListener('click', () => {
            const code = pickupCodeInput.value.trim().toUpperCase();
            if (!code) {
                alert('Por favor ingresa un código.');
                return;
            }

            // Búsqueda ultrarrápida en memoria (sin llamar a la API) por código de retiro o por ID
            const item = window.currentItems.find(i => {
                const pCode = (i.pickupCode || '').trim().toUpperCase();
                const itId = (i.itemID || '').trim().toUpperCase();
                return (pCode && pCode === code) || (itId && (itId === code || itId.startsWith(code)));
            });
            
            if (!item) {
                searchCodeResult.innerHTML = `<p class="text-xs text-rose-500 font-bold text-center">✕ Código no encontrado o incorrecto.</p>`;
                searchCodeResult.classList.remove('hidden');
                return;
            }

            const isDeliverable = String(item.status).toUpperCase() === 'VALIDATED';
            const isAlreadyDelivered = String(item.status).toUpperCase() === 'DELIVERED';
            
            if (isAlreadyDelivered) {
                searchCodeResult.innerHTML = `<p class="text-xs text-amber-500 font-bold text-center">⚠️ Este objeto ya fue entregado anteriormente.</p>`;
                searchCodeResult.classList.remove('hidden');
                return;
            }

            // Mostrar el resultado con los botones de acción
            searchCodeResult.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        <img src="${escapeHtml(item.imageUrl || getCategoryPlaceholderImage(item.category))}" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1">
                        <h5 class="font-bold text-sm theme-text-primary">${escapeHtml(item.title)}</h5>
                        <p class="text-xs theme-text-muted mt-1">ID Reporte: <strong>${escapeHtml(item.itemID.substring(0, 8))}...</strong></p>
                        <p class="text-xs font-semibold mt-1 ${isDeliverable ? 'text-blue-500' : 'text-rose-500'}">Estado: ${escapeHtml(item.status)}</p>
                    </div>
                </div>
                
                <!-- Botones de Acción (Entregar / Cancelar) -->
                <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
                    ${isDeliverable ? 
                        `<button type="button" id="deliverItemConfirmBtn" class="flex-1 btn-pill py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md cursor-pointer">
                            ✓ Entregar Objeto
                        </button>` 
                        : 
                        `<div class="flex-1 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl text-center border border-rose-200 dark:border-rose-900 font-medium">
                            ⚠️ Aún no está validado por seguridad
                        </div>`
                    }
                    <button type="button" id="cancelDeliverBtn" class="flex-1 btn-pill py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors cursor-pointer">
                        ✕ Cancelar
                    </button>
                </div>
            `;
            searchCodeResult.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();

            // Lógica del botón Cancelar
            const cancelBtn = document.getElementById('cancelDeliverBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    searchCodeResult.classList.add('hidden');
                    pickupCodeInput.value = '';
                });
            }

            // Lógica del botón Entregar
            const deliverItemConfirmBtn = document.getElementById('deliverItemConfirmBtn');
            if (deliverItemConfirmBtn) {
                deliverItemConfirmBtn.addEventListener('click', async function() {
                    const btn = this;
                    btn.disabled = true;
                    btn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Procesando...';

                    try {
                        // Cambiamos el estado en la base de datos (AWS DynamoDB)
                        await apiFetch(`${ITEMS_URL}/${encodeURIComponent(item.itemID)}/deliver`, {
                            method: 'PATCH',
                            body: JSON.stringify({})
                        });

                        alert('✓ ¡Objeto marcado como entregado exitosamente!');
                        pickupCodeInput.value = '';
                        searchCodeResult.classList.add('hidden');
                        
                        // Recargar los datos de DynamoDB para actualizar la tabla
                        loadData(); 
                    } catch (err) {
                        console.error('Error entregando:', err);
                        alert('Error de conexión al entregar: ' + err.message);
                        btn.disabled = false;
                        btn.innerHTML = '✓ Entregar Objeto';
                    }
                });
            }
        });
    }

    // 11. Inicializar Asistente Virtual MallBot
    initMallBot();

    // 12. Restaurar sesión activa de Cognito si la página fue recargada
    checkActiveSession();
});
