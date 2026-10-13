# 🛍️ Lost & Found Portal - Mall Intelligence Hub

Plataforma Serverless en **Amazon Web Services (AWS)** diseñada para centros comerciales, orientada a optimizar la gestión, custodia y devolución de objetos perdidos mediante un motor de coincidencias inteligente, notificaciones transaccionales y códigos QR de entrega anti-fraude.

---

## 🌟 Características Principales

* 🎨 **Diseño Moderno & Responsivo:** Inspirado en la estética limpia de *Sync Labs* con soporte completo para **Modo Claro** y **Modo Oscuro** (*Dimension*).
* 🔐 **Seguridad & Autenticación:** Integración con **Amazon Cognito** (User Pools) con gestión de roles para **Personal de Seguridad (Staff)** y **Visitantes (Clientes)**.
* 🤖 **Matching Inteligente Serverless:** Motor de scoring multicriterio (Categoría, Zona, Fecha y Similitud Textual) ejecutado en **AWS Bedrock Nova Lite**.
* 🖼️ **Almacenamiento Directo:** Carga segura de fotografías hacia **Amazon S3** mediante URLs prefirmadas.
* 🗄️ **Base de Datos NoSQL:** Gestión de reportes y coincidencias en **Amazon DynamoDB**.
* 📧 **Notificaciones Automáticas:** Envío de alertas por correo electrónico mediante **Amazon SNS** al validar o descartar coincidencias.
* 🎫 **Pase de Recojo Seguro (QR Anti-Fraude):** Generación de token QR para la validación física de pertenencia en el módulo de seguridad del mall.

---

## 🏗️ Arquitectura en AWS
<img width="1600" height="1410" alt="Arq" src="https://github.com/user-attachments/assets/47c72dc8-fca9-4149-8f01-61ec789ca46d" />

---

## 📁 Estructura del Proyecto

* [`index.html`](index.html): Maquetación semántica de la Landing Page, Modales y Portal de Gestión.
* [`styles.css`](styles.css): Estilos CSS modulares para temas Claro/Oscuro, variables y componentes interactivos.
* [`app.js`](app.js): Lógica de cliente, SDK de Amazon Cognito, llamadas REST API, filtros y renderizado.

---

## 🚀 Puesta en Marcha

1. Clona el repositorio:
   ```bash
   git clone https://github.com/<tu-usuario>/<tu-repositorio>.git
   ```
2. Abre [`index.html`](index.html) en cualquier navegador web o sírvelo con una extensión como Live Server.

---

## 👥 Equipo Hackathon
* Equipo: Nicolas Murcia, Alonzo Loyaga, Steven Relayza
* Programa: AWS re/Start
