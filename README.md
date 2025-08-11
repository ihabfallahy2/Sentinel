# 🚀 Sentinel

**Sentinel** es un proyecto de aprendizaje en **Java + Spring Boot** cuyo objetivo es servir como laboratorio para practicar desde lo básico hasta conceptos avanzados de desarrollo backend.

La idea nace de crear un **sistema de monitoreo de repositorios públicos** (por ejemplo, en GitHub) que pueda crecer por fases, incorporando múltiples tecnologías y buenas prácticas.

---

## 🎯 Objetivo General

El propósito de Sentinel es:

- Mantener un **catálogo de repositorios** a vigilar.
- Recolectar datos periódicamente usando **procesos batch**.
- Procesar la información y generar **alertas**.
- Distribuir estas alertas vía **mensajería** (Kafka, RabbitMQ, etc.).
- Exponer una API REST y, eventualmente, una interfaz web para consultar el historial.
- Integrar métricas, seguridad, despliegue y monitoreo.

Este proyecto se desarrolla **por fases**, cada una introduciendo nuevas herramientas y conceptos.

---

## 🗺 Roadmap de desarrollo

### **Fase 1 – Fundamentos**
- Spring Boot básico.
- CRUD de repositorios vigilados.
- Persistencia en H2 usando Spring Data JPA.
- API REST documentada con OpenAPI (Swagger).

### **Fase 2 – Consulta a GitHub**
- Uso de `WebClient` o `RestTemplate`.
- Integración con la API de GitHub para obtener información de los repositorios.
- Manejo de errores y almacenamiento de resultados.

### **Fase 3 – Procesos Batch**
- Spring Batch + `@Scheduled` para ejecución periódica.
- Lectura de la lista de repos, consulta a GitHub y almacenamiento histórico.

### **Fase 4 – Mensajería**
- Publicación de eventos en Kafka o RabbitMQ.
- Consumidores que procesen y guarden alertas.

### **Fase 5 – Seguridad**
- Spring Security con JWT o OAuth2 (login con GitHub).
- Roles y permisos.

### **Fase 6 – Webhooks**
- Recepción de eventos en tiempo real desde GitHub.
- Procesamiento y notificación inmediata.

### **Fase 7 – Observabilidad**
- Spring Boot Actuator.
- Métricas y health checks.
- Logging estructurado.

### **Fase 8 – Despliegue y CI/CD**
- Dockerización.
- Pipelines con GitHub Actions.
- Despliegue en un entorno cloud (Render, Railway, Heroku, etc.).

---

## 🛠 Tecnologías y librerías clave

- **Java 17**
- **Spring Boot** (Web, Data JPA, Batch, Security)
- **MapStruct** para mapeo de DTOs
- **H2 / PostgreSQL**
- **OpenAPI / Swagger**
- **Kafka o RabbitMQ**
- **Spring Boot Actuator** y **Micrometer**

---

## 📦 Estado actual

Actualmente el proyecto está en la **Fase 1**, con:
- API REST básica (`/api/repositories`)
- Persistencia en memoria (H2)
- Documentación con Swagger UI

Puedes ejecutar el proyecto con:

```bash
mvn spring-boot:run
```

## Swagger UI:

```bash
http://localhost:8080/swagger-ui.html
```

## 🤝 Contribuir

Este proyecto es principalmente para aprendizaje, pero se aceptan ideas y PRs que ayuden a cubrir las fases del roadmap.
