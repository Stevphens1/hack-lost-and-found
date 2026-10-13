# Documento de Producto Final
## Plataforma “Lost & Found”

**Programa:** AWS re/Start  
**Partner Educativo:** Morris & Opazo / Amazon Web Services  
**Equipo de Proyecto:** Nicolas Murcia, Alonzo Loyaga, Steven Relayza  
**Fecha:** Octubre 2026  

---

## 1. Problemática

La gestión tradicional de objetos perdidos y encontrados en lugares de alta concurrencia, tales como centros comerciales, aeropuertos e instituciones educativas, presenta graves deficiencias operativas que afectan tanto a los usuarios como al personal administrativo y de seguridad:

* **Fragmentación y falta de una fuente única de verdad:** Los reportes de extravío suelen dispersarse en cuadernos físicos, correos electrónicos aislados o formularios en papel sin centralización ni respaldo.
* **Procesos manuales y demoras excesivas:** La comparación visual de descripciones y fotografías depende exclusivamente de la memoria o revisión manual de los guardias, resultando en un proceso lento, impreciso y propenso a errores humanos.
* **Riesgo de fraude y falta de autenticación:** La entrega de pertenencias suele realizarse sin mecanismos estandarizados de validación de identidad ni comprobación de titularidad, lo que incrementa el riesgo de entregar bienes de alto valor a personas equivocadas.
* **Colapso de almacenes de custodia:** Al no existir un seguimiento automatizado de plazos, los almacenes se saturan de artículos no reclamados durante meses o años, sin un protocolo de disposición legal o impacto social.

---

## 2. Solución

Para resolver de raíz esta problemática, se desarrolló **Lost & Found**, una plataforma web corporativa centralizada y 100% *Serverless* que optimiza, automatiza y asegura todo el ciclo de recuperación de objetos perdidos mediante Inteligencia Artificial Generativa y Multimodal:

1. **Centralización digital:** Unifica los reportes de visitantes y los hallazgos de seguridad en una base de datos distribuida en tiempo real.
2. **Matching Multimodal Inteligente:** Emplea **Amazon Bedrock (Nova Lite)** para comparar simultáneamente imágenes, descripciones semánticas, zonas y horarios, calculando un porcentaje de afinidad objetivo.
3. **Pase de Retiro Seguro:** Genera un código alfanumérico único e intransferible una vez validada la coincidencia, garantizando entregas trazables y libres de fraude.
4. **Inteligencia Gerencial y Compromiso Social (ESG):** Incorpora un panel ejecutivo con mapas de calor de incidentes para seguridad preventiva y un módulo de custodia que emite actas oficiales para la donación benéfica de artículos no reclamados tras 30 y 90 días.

---

## 3. Alcance del Proyecto

El objetivo principal de la plataforma es centralizar, optimizar y auditar la administración de objetos perdidos y encontrados dentro de un centro comercial. El alcance final del proyecto comprende:

* **Interfaz Web Moderna y Responsiva:** Diseño interactivo adaptado para dos roles operativos:
  * *Clientes / Visitantes:* Reporte rápido, seguimiento de sus pertenencias y consulta de pases de retiro.
  * *Staff (Personal de Seguridad / Gerencia):* Registro de hallazgos, revisión de coincidencias asistida por IA y entrega autenticada.
* **Autenticación y Control de Acceso (RBAC):** Inicio de sesión seguro mediante tokens JWT para proteger los datos personales de contacto y restringir la validación de entregas exclusivamente al personal autorizado.
* **Registro Multicanal de Objetos:**
  * *Vía Formulario Estructurado:* Captura categorizada de datos (tipo de reporte, categoría, zona del mall, fecha, hora, descripción y foto).
  * *Vía Asistente Conversacional (MallBot con IA):* Chatbot impulsado por procesamiento de lenguaje natural que guía al usuario, extrae automáticamente los detalles relevantes y diligencia el reporte sin requerir llenado manual.
* **Procesamiento Serverless e IA Multimodal:**
  * Ejecución de lógica de negocio bajo demanda sin servidores dedicados.
  * Comparación inteligente con **Amazon Bedrock (Nova Lite)**: análisis simultáneo de imágenes y coherencia sintáctica para determinar similitud con veredicto justificado.
* **Sistema de Notificaciones Automáticas en Tiempo Real:** Envío instantáneo de alertas por correo electrónico vía **Amazon SNS** ante la detección de coincidencias y la validación de reclamos.
* **Flujo Seguro de Reclamación y Verificación de Entrega:**
  * Generación de un código de verificación único para el cliente.
  * Módulo de validación en ventanilla para que el guardia coteje el código con la base de datos antes de entregar el bien físico.
* **Panel de Control Gerencial y Gestión de Custodia (ESG):**
  * Dashboard de analítica operativa: valor económico protegido, tasa real de retorno, embudo de conversión y resumen ejecutivo automatizado.
  * Mapa de calor semanal (Día × Hora) y puntos calientes por zona para optimizar patrullajes de seguridad.
  * Módulo legal de custodia con emisión automatizada de **Actas Oficiales de Donación (A4)** con soporte de firma digitalizada y asignación de entidades benéficas.

---

## 4. Servicios de AWS Utilizados

### Frontend y Entrega de Contenido
* **Amazon S3 (Simple Storage Service):** Se configuraron dos buckets privados:
  * `lost-found-frontend-app`: Aloja los artefactos estáticos de la aplicación web (HTML5, CSS3, JavaScript modular).
  * `lost-found-fotos`: Almacena de manera segura y cifrada las evidencias fotográficas de los objetos perdidos y encontrados.
* **Amazon CloudFront:** Red de Distribución de Contenido (CDN) global que entrega la aplicación web con latencia mínima, fuerza conexiones HTTPS seguras y protege el bucket de origen mediante *Origin Access Control (OAC)*.

### Backend y Cómputo Serverless
* **Amazon API Gateway:** Expone una API REST segura con endpoints optimizados (`/items`, `/matches`, `/chat`) que canalizan las peticiones autenticadas hacia la capa de cómputo.
* **AWS Lambda:** Funciones serverless en Python y Node.js que ejecutan la lógica de negocio sin aprovisionamiento de servidores:
  * `lost-found-create-item`: Procesamiento y registro de items en base de datos.
  * `lost-found-match-engine`: Orquestación del análisis de similitud.
  * `lost-found-assistant`: Lógica del chatbot conversacional MallBot.

### Inteligencia Artificial Generativa
* **Amazon Bedrock (Modelo Nova Lite `amazon.nova-lite-v1:0`):**
  * *Motor de Similitud Visual:* Analiza y compara simultáneamente las fotografías reales de los objetos hallados frente a los reportes de pérdida, identificando atributos como color, marca, desgaste y forma geométrica.
  * *Asistente Conversacional:* Interpreta intenciones de usuario en lenguaje natural para extraer parámetros estructurados (categoría, ubicación, fecha aproximada).

### Base de Datos y Almacenamiento NoSQL
* **Amazon DynamoDB:** Base de datos NoSQL completamente gestionada de baja latencia con dos tablas principales:
  * `LostFoundItems`: Almacena los reportes individuales con metadatos completos (ID, título, categoría, zona, descripción, URL en S3, tipo `LOST`/`FOUND`, estado, fecha/hora y usuario).
  * `LostFoundMatches`: Almacena los emparejamientos calculados por la IA (ID del perdido vs. ID del hallazgo, porcentaje de similitud `matchScore`, estado `POSSIBLE`/`VALIDATED`/`REJECTED` y código de retiro generado).

### Seguridad, Notificaciones y Gobierno
* **Amazon Cognito:** Control de identidades, registro de usuarios, verificación de correos y emisión de tokens JWT integrados con API Gateway.
* **Amazon SNS (Simple Notification Service):** Tópico `LostFoundMatchNotifications` bajo modelo Pub/Sub para el envío inmediato de alertas por correo a usuarios y administradores.
* **AWS IAM (Identity and Access Management):** Políticas de seguridad granulares aplicando el principio de menor privilegio (*Least Privilege*) entre Lambdas, DynamoDB, S3 y Bedrock.
* **Amazon CloudWatch:** Monitoreo centralizado de métricas de invocación, latencia y logs de ejecución de las funciones Lambda y APIs.
* **AWS CloudTrail:** Registro continuo y auditoría de llamadas a la API y eventos de infraestructura para trazabilidad y cumplimiento normativo.

---

## 5. Arquitectura del Sistema

```
                                  ARQUITECTURA LOST & FOUND
                                   (Amazon Web Services)

 [Visitante]      [Personal Staff]
      │                  │
      ▼                  ▼
┌───────────────────────────────┐
│       Amazon CloudFront       │ ── HTTPS / CDN con OAC
└───────────────┬───────────────┘
                │
                ├─────────────────────────────────────────┐
                ▼                                         ▼
      ┌──────────────────┐                      ┌──────────────────┐
      │  Amazon S3 (Web) │                      │  Amazon Cognito  │ (Autenticación JWT)
      └──────────────────┘                      └─────────┬────────┘
                                                          │ Token
                                                          ▼
                                                ┌──────────────────┐
                                                │Amazon API Gateway│
                                                └─────────┬────────┘
                                                          │
                    ┌─────────────────────────────────────┼─────────────────────────────────────┐
                    ▼                                     ▼                                     ▼
          ┌──────────────────┐                  ┌──────────────────┐                  ┌──────────────────┐
          │  Lambda (Items)  │                  │ Lambda (Matcher) │                  │Lambda (Assistant)│
          └─────────┬────────┘                  └─────────┬────────┘                  └─────────┬────────┘
                    │                                     │                                     │
         ┌──────────┴──────────┐                          ├──────────────────┐                  │
         ▼                     ▼                          ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────────┐      ┌──────────────────┐  ┌─────────────────────────────────┐
│ Amazon DynamoDB  │  │  Amazon S3 Fotos │      │    Amazon SNS    │  │     Amazon Bedrock Nova Lite    │
│  (Items/Matches) │  │ (Media Storage)  │      │ (Notificaciones) │  │  (Visión Multimodal / Chatbot)  │
└──────────────────┘  └──────────────────┘      └──────────────────┘  └─────────────────────────────────┘
         ▲                                                                             ▲
         │                               [ Monitoreo & Auditoría ]                     │
         └────────────────────────── Amazon CloudWatch / AWS CloudTrail ───────────────┘
```

---

## 6. Flujo Integral de la Aplicación

### Paso 1: Acceso y Registro Seguro
El usuario ingresa a la plataforma mediante la URL segura de CloudFront. Si es un usuario nuevo, completa el formulario de registro; Amazon Cognito valida sus credenciales y emite un código de verificación por correo electrónico. Simultáneamente, el usuario queda suscrito a las notificaciones automáticas de Amazon SNS.

### Paso 2: Registro de Objetos (Multicanal)
El usuario o el personal de seguridad registra el objeto a través de dos modalidades disponibles:
1. **Formulario estructurado:** Selección asistida de categorías, ubicación detallada en el mall, descripción y carga directa de fotografía hacia Amazon S3.
2. **Asistente MallBot:** Conversación fluida con el bot impulsado por Amazon Bedrock, el cual extrae los parámetros automáticamente y diligencia el reporte.

### Paso 3: Análisis Inteligente de Coincidencias y Notificación
Al registrarse un nuevo objeto, la función Lambda invoca a **Amazon Bedrock (Nova Lite)** para comparar el nuevo registro contra el inventario activo del tipo opuesto (`LOST` vs. `FOUND`).
* Bedrock analiza las fotografías y las descripciones textuales, emitiendo un veredicto técnico justificado y un porcentaje de afinidad.
* Si la coincidencia supera el umbral, **Amazon SNS** envía una alerta inmediata por correo al personal de seguridad para su revisión en la pestaña *Coincidencias*.
* El guardia puede **Validar** o **Descartar** el match con un solo clic.

### Paso 4: Visualización y Pase de Recojo Seguro
Una vez validada la coincidencia por seguridad:
* El visitante recibe un correo notificándole que su pertenencia fue hallada y confirmada.
* Al ingresar a su portal, el reporte cambia a estado `Propiedad Validada` y se habilita el botón **Ver código de recojo**.
* El sistema despliega el **Pase de Recojo Seguro**, mostrando un código alfanumérico único (ej. `LF-8ZDM54`) e instrucciones para acercarse al módulo central con su documento de identidad.

### Paso 5: Entrega Física en Ventanilla
* En el módulo de seguridad, el visitante presenta su código de retiro.
* El guardia ingresa el código en la herramienta de búsqueda de entregas; el sistema valida la coincidencia en memoria y muestra los datos del reporte.
* El personal hace clic en **✓ Entregar Objeto**, marcando el bien como entregado (`DELIVERED`) en DynamoDB y cerrando el ciclo con auditoría completa.

### Paso 6: Panel de Control Gerencial y Lote de Donación (+30 y +90 días)
Para la administración del centro comercial, la plataforma provee un panel ejecutivo con analítica en tiempo real:
* **Indicadores Clave (KPIs):** Total de registros, tasa de retorno efectiva (~50%), permanencia promedio en custodia, cantidad de artículos aptos para donación y valor económico protegido estimado según categoría.
* **Embudo de Recuperación Secuencial:** Visualiza las cuatro etapas del proceso (*Reportes de Pérdida ➔ Matches IA ➔ Validados por Seguridad ➔ Entregados al Propietario*) con indicadores de cobertura y precisión.
* **Tendencia Adaptativa de Incidentes:** Gráfica diaria de pérdidas vs. hallazgos con cifras directas sobre las barras.
* **Mapa de Calor Semanal (Día × Franja Horaria):** Matriz cruzada para optimizar los turnos y rondas preventivas del equipo de vigilancia en zonas críticas (puntos calientes).
* **Gestión de Donaciones y Disposición Legal:** Identificación automatizada de bienes no reclamados que superan los 30 días (donables) y 90 días (baja legal definitiva).
* **Emisión de Acta Oficial de Donación (A4):** Generación e impresión de actas administrativas membretadas, con asignación de la institución receptora y soporte para la carga de **firmas digitales** de Gerencia, Seguridad y la Entidad Benéfica.

---

## 7. Estimación de Costos (AWS Pricing Calculator)

La arquitectura fue diseñada bajo el paradigma **Serverless**, eliminando costos fijos de servidores inactivos y garantizando que el centro comercial pague estrictamente por el uso real:

### Desglose Mensual Estimado (Escenario Piloto: 1,000 reportes / mes)

| Servicio AWS | Concepto / Volumen Mensual | Costo Estimado (USD) |
| :--- | :--- | :--- |
| **AWS Lambda** | 50,000 peticiones / mes (~256 MB por invocación) | **\$0.00** *(Cubierto por AWS Free Tier: 1M gratis)* |
| **Amazon DynamoDB** | 1,000 escrituras y 10,000 lecturas / mes (< 1 GB data) | **\$0.00** *(Cubierto por Free Tier: 25 GB gratis)* |
| **Amazon S3** | 2,000 imágenes (~4 GB almacenamiento y transferencias) | **\$0.10** |
| **Amazon CloudFront** | 10 GB de transferencia de salida (datos cacheados) | **\$0.00** *(Cubierto por Free Tier: 1 TB gratis)* |
| **Amazon Cognito** | ~500 usuarios activos mensuales (MAUs) | **\$0.00** *(Cubierto por Free Tier: 50,000 MAUs)* |
| **Amazon Bedrock** | Nova Lite (~1,500 llamadas multimodales texto + imagen) | **\$1.45** *(Cobro por tokens de entrada/salida)* |
| **Amazon SNS** | 1,000 correos electrónicos de notificación | **\$0.00** *(Primeros 1,000 emails gratis/mes)* |
| **Amazon CloudWatch** | Métricas estándar y 500 MB de logs de ejecución | **\$0.00** *(Cubierto por Free Tier: 5 GB gratis)* |
| **Total Mensual Estimado** | **Operación completa del sistema en producción** | **~\$1.55 – \$1.70 USD / mes** |

> 🔗 **Estimación oficial en AWS Pricing Calculator:**  
> https://calculator.aws/#/estimate?id=0c4943255039288d2be38efedfc831e91c873f93

---

## 8. Alineación con el AWS Well-Architected Framework

La plataforma fue evaluada y diseñada siguiendo los seis pilares de buenas prácticas de Amazon Web Services:

1. **Excelencia Operativa:** Arquitectura orientada a eventos (*event-driven*) con despliegues automatizados y observabilidad continua mediante Amazon CloudWatch.
2. **Seguridad:** Protección perimetral con CloudFront (HTTPS forzado), almacenamiento privado con Origin Access Control (OAC), control de acceso por roles con Cognito y principio de menor privilegio en políticas de IAM.
3. **Confiabilidad:** Servicios gestionados de alta disponibilidad multizona nativa (S3, DynamoDB, Lambda), con recuperación automática y tolerancia a fallos.
4. **Eficiencia de Rendimiento:** Inferencia multimodal de baja latencia con Amazon Bedrock Nova Lite y entrega de contenido estático en el borde de la red a través de CloudFront.
5. **Optimización de Costos:** Modelo 100% *Pay-as-you-go*; sin costos de servidores inactivos, con un gasto mensual inferior a \$2.00 USD en etapas tempranas.
6. **Sostenibilidad:** Reducción sustancial de la huella de carbono al consolidar cómputo en la nube elástica de AWS frente a infraestructura tradicional *on-premises*.

---

## 9. Conclusiones e Impacto del Proyecto

* **Eficiencia Operativa Comprobada:** Reduce el tiempo promedio de cotejo de horas o días a menos de 5 segundos gracias a la visión artificial de Amazon Bedrock.
* **Seguridad y Trazabilidad Absoluta:** La integración del código de retiro y la verificación de identidad mitiga al 100% el riesgo de entregas equivocadas o reclamos fraudulentos.
* **Impacto Social y Gobernanza (ESG):** Transforma el inventario estancado en un programa activo de donación benéfica, con respaldo legal y auditoría transparente para la administración del centro comercial.
