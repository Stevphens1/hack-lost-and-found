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
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');

    if (theme === 'dark') {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme', 'dark');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'sun');
        }
        if (themeText) {
            themeText.textContent = 'Modo Claro';
        }
    } else {
        body.classList.remove('dark-theme', 'dark');
        body.classList.add('light-theme');
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
        type: String(raw.type || raw.Type || raw.itemType || 'LOST').toUpperCase(),
        title: raw.title || raw.Title || raw.name || raw.Name || 'Sin título',
        category: raw.category || raw.Category || 'General',
        zone: raw.zone || raw.Zone || raw.location || raw.Location || 'Zona no indicada',
        date: raw.date || raw.Date || raw.eventDate || raw.EventDate || (raw.createdAt ? String(raw.createdAt).slice(0, 10) : ''),
        description: raw.description || raw.Description || 'Sin descripción',
        status: String(raw.status || raw.Status || 'REGISTERED').toUpperCase(),
        imageUrl: raw.imageUrl || raw.ImageUrl || raw.photoUrl || raw.photo || raw.image || raw.s3Url || '',
        createdAt: raw.createdAt || raw.CreatedAt || raw.timestamp || Date.now(),
        createdBy: raw.createdBy || raw.CreatedBy || raw.userId || raw.userEmail || raw.email || raw.sub || ''
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
                        onclick="showPickupModal('${escapeHtml(item.itemID)}', '${escapeHtml(item.title)}')"
                        class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full shadow-md shadow-blue-500/20 transition-all shrink-0 cursor-pointer"
                    >
                        Ver Cita & QR
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

        if (userSpecificItems.length > 0) {
            items = userSpecificItems;
        } else {
            items = items.filter(i => String(i.type || '').toUpperCase() === 'LOST');
        }
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

        renderItems();
        if (window.currentUserIsStaff) {
            renderStaffMatches();
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
    }
}

// ============================================================================
// 12. MODAL DE CITA & CÓDIGO QR 100% VISIBLE (CLIENTE & STAFF)
// ============================================================================
function showPickupModal(itemId, itemTitle) {
    let modal = document.getElementById('pickupModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pickupModal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
        document.body.appendChild(modal);
    }

    const qrData = `LOST_FOUND_VALIDATION|ID:${itemId}|USER:${window.currentUserData?.email || 'Usuario'}|TIME:${Date.now()}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}&margin=1`;

    modal.innerHTML = `
        <div class="theme-card border rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onclick="closePickupModal()" class="absolute top-4 right-4 theme-text-muted hover:theme-text-primary p-2 text-lg cursor-pointer">
                ✕
            </button>
            <div class="text-center">
                <div class="w-12 h-12 bg-sky-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/20">
                    <span class="text-2xl">🎫</span>
                </div>
                <h3 class="text-xl font-extrabold theme-text-primary font-heading">Pase de Recojo Seguro</h3>
                <p class="text-xs theme-text-muted mt-1">${escapeHtml(itemTitle)}</p>
            </div>

            <!-- Contenedor QR Blanco con Imagen Garantizada -->
            <div class="my-6 text-center">
                <div class="qr-container mx-auto p-3 bg-white rounded-2xl border border-slate-200 shadow-sm inline-block">
                    <img src="${qrImageUrl}" alt="Código QR de Validación" class="w-44 h-44 mx-auto rounded-lg" />
                </div>
                <p class="text-[11px] theme-text-muted mt-2.5 font-mono font-medium">Token de Verificación Anti-Fraude</p>
            </div>

            <!-- Recuadro de Instrucciones con Alto Contraste -->
            <div class="bg-sky-50 dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-2xl p-4 text-xs space-y-2.5">
                <div class="flex items-center justify-between">
                    <span class="text-slate-600 dark:text-slate-400 font-medium">📍 Lugar de entrega:</span>
                    <span class="font-bold text-slate-900 dark:text-white">Módulo Central (Piso 1)</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-600 dark:text-slate-400 font-medium">🕒 Horario de atención:</span>
                    <span class="font-bold text-slate-900 dark:text-white">Lun a Dom: 10:00 AM - 9:00 PM</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-600 dark:text-slate-400 font-medium">📄 Requisito obligatorio:</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">DNI / Documento de Identidad</span>
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
// 13. GESTIÓN DE SESIÓN & COGNITO AUTH
// ============================================================================
function showApplication(session) {
    window.activeSession = session;
    const payload = session.getIdToken().decodePayload();
    window.currentUserData = payload;

    const rawGroups = payload['cognito:groups'] || [];
    const groups = normalizeGroups(rawGroups);
    const isStaff = groups.includes('STAFF');
    window.currentUserIsStaff = isStaff;

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
        roleBadge.textContent = isStaff ? 'Personal de Seguridad (Staff)' : 'Visitante Registrado';
        roleBadge.className = isStaff
            ? 'text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full'
            : 'text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 px-3 py-1 rounded-full';
    }

    const formTitle = document.getElementById('formTitle');
    const formHelp = document.getElementById('formHelp');
    const itemType = document.getElementById('itemType');
    const submitBtnText = document.getElementById('submitBtnText');
    const itemsTitle = document.getElementById('itemsTitle');
    const itemsSubtitle = document.getElementById('itemsSubtitle');
    const staffTabs = document.getElementById('staffTabs');
    const itemsView = document.getElementById('itemsView');
    const matchesView = document.getElementById('matchesView');
    const tabItems = document.getElementById('tabItems');
    const tabMatches = document.getElementById('tabMatches');

    if (isStaff) {
        if (formTitle) formTitle.textContent = 'Registrar Objeto Encontrado';
        if (formHelp) formHelp.textContent = 'El personal de seguridad registra los objetos encontrados en el mall para iniciar el matching.';
        if (itemType) itemType.value = 'FOUND';
        if (submitBtnText) submitBtnText.textContent = 'Publicar Reporte de Hallazgo';
        if (itemsTitle) itemsTitle.textContent = 'Todos los Reportes Activos';
        if (itemsSubtitle) itemsSubtitle.textContent = 'Inventario general de objetos perdidos y hallazgos en custodia.';
        if (staffTabs) staffTabs.classList.remove('hidden');
    } else {
        if (formTitle) formTitle.textContent = 'Reportar Objeto Extraviado';
        if (formHelp) formHelp.textContent = 'Describe tu objeto para que nuestro motor de búsqueda lo compare con los hallazgos de seguridad.';
        if (itemType) itemType.value = 'LOST';
        if (submitBtnText) submitBtnText.textContent = 'Enviar Reporte de Pérdida';
        if (itemsTitle) itemsTitle.textContent = 'Mis Reportes Registrados';
        if (itemsSubtitle) itemsSubtitle.textContent = 'Seguimiento en tiempo real del estado de tus pertenencias.';
        if (staffTabs) staffTabs.classList.add('hidden');
        if (itemsView) itemsView.classList.remove('hidden');
        if (matchesView) matchesView.classList.add('hidden');
    }

    // Resetear pestañas staff
    if (tabItems && tabMatches) {
        tabItems.className = 'px-4 py-2 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm';
        tabMatches.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary';
    }

    loadData();
}

function showLanding() {
    window.activeSession = null;
    window.currentUserIsStaff = false;
    window.currentUserData = null;
    window.currentItems = [];
    window.currentMatches = [];

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

function updateMallBotLiveBadges(extracted) {
    const badgesContainer = document.getElementById('mallBotStateBadges');
    if (!badgesContainer) return;

    if (!extracted || Object.keys(extracted).length === 0) {
        badgesContainer.innerHTML = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 theme-text-muted">Esperando datos...</span>';
        return;
    }

    const pills = [];
    if (extracted.title) pills.push(`📌 ${escapeHtml(extracted.title)}`);
    if (extracted.category) pills.push(`🏷️ ${escapeHtml(extracted.category)}`);
    if (extracted.zone) pills.push(`📍 ${escapeHtml(extracted.zone)}`);
    if (extracted.date) pills.push(`📅 ${escapeHtml(extracted.date)}`);
    if (extracted.time) pills.push(`⏰ ${escapeHtml(extracted.time)}`);
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
    if (extracted.title && String(extracted.title).trim() !== '' && String(extracted.title).toLowerCase() !== 'null') {
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
    if (extracted.category && String(extracted.category).trim() !== '' && String(extracted.category).toLowerCase() !== 'null') {
        const categorySelect = document.getElementById('category');
        const categoryOtherContainer = document.getElementById('categoryOtherContainer');
        const categoryOtherInput = document.getElementById('categoryOtherInput');
        if (categorySelect) {
            const rawCat = String(extracted.category).toLowerCase();
            let matched = false;
            for (let i = 0; i < categorySelect.options.length; i++) {
                const optText = categorySelect.options[i].text.toLowerCase();
                const optVal = categorySelect.options[i].value.toLowerCase();
                if (rawCat === optVal || rawCat === optText || rawCat.includes(optVal) || optText.includes(rawCat) || rawCat.includes(optText)) {
                    categorySelect.selectedIndex = i;
                    matched = true;
                    if (categoryOtherContainer) categoryOtherContainer.classList.add('hidden');
                    break;
                }
            }
            if (!matched && categoryOtherInput) {
                categorySelect.value = 'Otros';
                if (categoryOtherContainer) categoryOtherContainer.classList.remove('hidden');
                categoryOtherInput.value = extracted.category;
                categoryOtherInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
            categorySelect.classList.add('field-autofilled');
            setTimeout(() => categorySelect.classList.remove('field-autofilled'), 2000);
        }
    }

    // 3. Zona
    if (extracted.zone && String(extracted.zone).trim() !== '' && String(extracted.zone).toLowerCase() !== 'null') {
        const zoneSelect = document.getElementById('zone');
        const zoneOtherContainer = document.getElementById('zoneOtherContainer');
        const zoneOtherInput = document.getElementById('zoneOtherInput');
        if (zoneSelect) {
            const rawZone = String(extracted.zone).toLowerCase();
            let matched = false;
            for (let i = 0; i < zoneSelect.options.length; i++) {
                const optText = zoneSelect.options[i].text.toLowerCase();
                const optVal = zoneSelect.options[i].value.toLowerCase();
                if (rawZone === optVal || rawZone === optText || rawZone.includes(optVal) || optText.includes(rawZone) || rawZone.includes(optText)) {
                    zoneSelect.selectedIndex = i;
                    matched = true;
                    if (zoneOtherContainer) zoneOtherContainer.classList.add('hidden');
                    break;
                }
            }
            if (!matched && zoneOtherInput) {
                zoneSelect.value = 'Otra Zona...';
                if (zoneOtherContainer) zoneOtherContainer.classList.remove('hidden');
                zoneOtherInput.value = extracted.zone;
                zoneOtherInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            zoneSelect.dispatchEvent(new Event('change', { bubbles: true }));
            zoneSelect.classList.add('field-autofilled');
            setTimeout(() => zoneSelect.classList.remove('field-autofilled'), 2000);
        }
    }

    // 4. Fecha
    if (extracted.date && String(extracted.date).trim() !== '' && String(extracted.date).toLowerCase() !== 'null') {
        const dateInput = document.getElementById('itemDate');
        if (dateInput) {
            dateInput.value = extracted.date;
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            dateInput.classList.add('field-autofilled');
            setTimeout(() => dateInput.classList.remove('field-autofilled'), 2000);
        }
    }

    // 4.1 Hora Aproximada (Opcional)
    if (extracted.time && String(extracted.time).trim() !== '' && String(extracted.time).toLowerCase() !== 'null') {
        const timeInput = document.getElementById('itemTime');
        if (timeInput) {
            timeInput.value = extracted.time;
            timeInput.dispatchEvent(new Event('input', { bubbles: true }));
            timeInput.dispatchEvent(new Event('change', { bubbles: true }));
            timeInput.classList.add('field-autofilled');
            setTimeout(() => timeInput.classList.remove('field-autofilled'), 2000);
        }
    }

    // 5. Descripción
    if (extracted.description && String(extracted.description).trim() !== '' && String(extracted.description).toLowerCase() !== 'null') {
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

    // Si el usuario ya adjuntó foto o la IA marcó completitud, mostrar botón de guardado
    const submitWrap = document.getElementById('mallBotSubmitWrap');
    if (submitWrap) {
        const titleVal = document.getElementById('title')?.value?.trim();
        const catVal = document.getElementById('category')?.value;
        const zoneVal = document.getElementById('zone')?.value;
        const dateVal = document.getElementById('itemDate')?.value;
        const descVal = document.getElementById('description')?.value?.trim();
        const hasAllFields = Boolean(titleVal && catVal && zoneVal && dateVal && descVal);

        if (hasAllFields && (isComplete || window.mallBotAttachedPhoto)) {
            submitWrap.classList.remove('hidden');
        } else {
            submitWrap.classList.add('hidden');
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
                    sendMallBotMessage('No tengo foto');
                });
            }
        }

        // 6. Aplicar los campos extraídos al formulario
        applyMallBotExtractedData(result.extracted || {}, result.isComplete || false);

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
                    const s3Res = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': fileMime },
                        body: photoFile
                    });

                    if (!s3Res.ok) {
                        console.warn('S3 upload HTTP code:', s3Res.status);
                        throw new Error(`Fallo en Amazon S3 (Código ${s3Res.status})`);
                    }
                }
            } catch (s3Err) {
                console.error('Error subiendo foto:', s3Err);
                throw new Error(`No se pudo subir la fotografía a S3: ${s3Err.message}`);
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

                // Si los datos requeridos están listos, mostrar botón Guardar Reporte Ahora
                const titleVal = document.getElementById('title')?.value?.trim();
                const catVal = document.getElementById('category')?.value;
                const zoneVal = document.getElementById('zone')?.value;
                const dateVal = document.getElementById('itemDate')?.value;
                const descVal = document.getElementById('description')?.value?.trim();
                if (titleVal && catVal && zoneVal && dateVal && descVal) {
                    document.getElementById('mallBotSubmitWrap')?.classList.remove('hidden');
                }
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
            window.mallBotHistory = [];
            window.mallBotAttachedPhoto = null;
            if (photoInput) photoInput.value = '';
            if (photoBar) photoBar.classList.add('hidden');
            const messagesContainer = document.getElementById('mallBotMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div class="mallbot-msg mallbot-msg-bot">
                        <p class="font-medium">¡Conversación reiniciada! 🔄</p>
                        <p class="mt-1 text-xs theme-text-secondary">Dime qué objeto perdiste, usa el micrófono 🎙️ o adjunta una foto 📷 para comenzar.</p>
                    </div>
                `;
            }
            updateMallBotLiveBadges(null);
            document.getElementById('mallBotSubmitWrap')?.classList.add('hidden');
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

    // 10. Pestañas de Staff (Items vs Matches)
    const tabItems = document.getElementById('tabItems');
    const tabMatches = document.getElementById('tabMatches');
    const itemsView = document.getElementById('itemsView');
    const matchesView = document.getElementById('matchesView');

    if (tabItems && tabMatches) {
        tabItems.addEventListener('click', () => {
            itemsView?.classList.remove('hidden');
            matchesView?.classList.add('hidden');
            tabItems.className = 'px-4 py-2 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm';
            tabMatches.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary';
        });

        tabMatches.addEventListener('click', () => {
            itemsView?.classList.add('hidden');
            matchesView?.classList.remove('hidden');
            tabItems.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary';
            tabMatches.className = 'px-4 py-2 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm';
            renderStaffMatches();
        });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadData());
    }

    // 11. Inicializar Asistente Virtual MallBot
    initMallBot();

    // 12. Restaurar sesión activa de Cognito si la página fue recargada
    checkActiveSession();
});
