# Kubernetes deployment (Traefik)

Este directorio contiene manifests base para desplegar `my-warehouse` en un cluster Kubernetes estándar con Traefik como Ingress Controller.

## Estructura

- `namespace.yaml`: namespace `my-warehouse`
- `configmap.yaml`: configuración no sensible (URL frontend y CORS)
- `secret.example.yaml`: plantilla de secretos (copiar/adaptar antes de desplegar)
- `postgres.yaml`: `StatefulSet` + `Service` de PostgreSQL
- `migration-job.yaml`: Job para ejecutar `alembic upgrade head`
- `backend.yaml`: `Deployment` + `Service` del backend FastAPI
- `frontend.yaml`: `Deployment` + `Service` del frontend Angular+Nginx
- `ingress.yaml`: Ingress para Traefik (rutas `/` y `/api`)
- `kustomization.yaml`: bundle para aplicar todo junto

## Build y push de imágenes

Desde la raíz del repo:

```bash
docker build -t ghcr.io/<tu-org>/my-warehouse-backend:<tag> ./backend
docker build -t ghcr.io/<tu-org>/my-warehouse-frontend:<tag> ./frontend

docker push ghcr.io/<tu-org>/my-warehouse-backend:<tag>
docker push ghcr.io/<tu-org>/my-warehouse-frontend:<tag>
```

## Preparar configuración

1. Copia `secret.example.yaml` a un fichero privado (por ejemplo `secret.yaml`) y reemplaza valores.
2. Ajusta en `configmap.yaml` e `ingress.yaml` tu dominio real (por defecto `my-warehouse.example.com`).
3. Ajusta imágenes/tags en `kustomization.yaml` o con `kustomize edit set image`.

## Despliegue

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/postgres.yaml
kubectl apply -f deploy/k8s/migration-job.yaml
kubectl wait --for=condition=complete --timeout=180s job/my-warehouse-migrate -n my-warehouse
kubectl apply -f deploy/k8s/backend.yaml
kubectl apply -f deploy/k8s/frontend.yaml
kubectl apply -f deploy/k8s/ingress.yaml
```

O en bloque (si ya tienes secretos correctos):

```bash
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -k deploy/k8s
```

## Notas

- El frontend usa `'/api/v1'` fuera de `localhost:4200`, por lo que funciona detrás de Ingress con ruta `/api` hacia backend.
- El backend toma `DATABASE_URL` desde variable de entorno, también usada por Alembic en el Job de migración.
- Si usas cert-manager, actualiza `secretName` de TLS o añade las anotaciones necesarias para tu issuer.
