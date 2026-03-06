# Kubernetes deployment (Traefik + Talos hardening)

Este directorio contiene manifests para desplegar `my-warehouse` en Kubernetes con Traefik y PostgreSQL externo.

## Estructura

- `namespace.yaml`: namespace `my-warehouse` con Pod Security `restricted`
- `configmap.yaml`: configuración no sensible (URL frontend y CORS)
- `secret.example.yaml`: plantilla de secretos (`DATABASE_URL` externa + secretos app)
- `media-nfs.yaml`: `PersistentVolume` + `PersistentVolumeClaim` NFS para `/app/media`
- `migration-job.yaml`: job de migración (`alembic upgrade head`)
- `backend.yaml`: deployment/service FastAPI (rootless + security hardening)
- `frontend.yaml`: deployment/service Angular+Nginx (rootless + security hardening)
- `ingress.yaml`: ingress Traefik (`/api` + `/media` al backend, `/` al frontend)

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
3. Ajusta imágenes/tags en `backend.yaml`, `frontend.yaml` y `migration-job.yaml`.
4. Ajusta NFS en `media-nfs.yaml`:
   - `spec.nfs.server`
   - `spec.nfs.path`
   - capacidad (`storage`) y `storageClassName` si aplica

## Despliegue

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/media-nfs.yaml
kubectl apply -f deploy/k8s/migration-job.yaml
kubectl wait --for=condition=complete --timeout=180s job/my-warehouse-migrate -n my-warehouse
kubectl apply -f deploy/k8s/backend.yaml
kubectl apply -f deploy/k8s/frontend.yaml
kubectl apply -f deploy/k8s/ingress.yaml
```

## Notas de seguridad (Talos)

- Se aplica baseline `restricted` en namespace.
- Pods de app/migration sin token de ServiceAccount automático (`automountServiceAccountToken: false`).
- Security hardening en contenedores:
  - `runAsNonRoot`
  - `seccompProfile: RuntimeDefault`
  - `allowPrivilegeEscalation: false`
  - `capabilities.drop: [ALL]`
  - `readOnlyRootFilesystem: true` (con `emptyDir` en `/tmp`)
- El backend monta `my-warehouse-backend-media` en `/app/media`.

## Notas operativas

- El frontend usa `'/api/v1'` fuera de `localhost:4200`, por lo que funciona detrás de Ingress con ruta `/api` hacia backend.
- El storage público de fotos usa URLs `/media/...`; el Ingress debe enrutar también `/media` al backend o las imágenes acabarán resolviendo contra la SPA del frontend.
- El backend y Alembic usan `DATABASE_URL` desde Secret (PostgreSQL externo).
- Para NFS con `root_squash`, asegúrate de permisos de escritura para `uid/gid 10001` en el export.
- Si usas cert-manager, actualiza `secretName` de TLS o añade anotaciones del issuer en `ingress.yaml`.
