# Kubernetes: overview

A learning path on Kubernetes for a data engineer who already knows containers (the Docker subject) and the idea of a delivery loop (the DevOps subject). It uses a real three node cluster and ends with a small data pipeline.
Thai and English, built on 2026-11-20 from five books (Kubernetes Up and Running, Core Kubernetes, Programming Kubernetes, Kubernetes Patterns, Learning Helm) and from runs against a real cluster.

## Lessons

| # | Slug | Phase | Exercise | Labs |
|---|---|---|---|---|
| 1 | `why-kubernetes` | A | `01_cluster.py` | `ClusterLab` |
| 2 | `pods` | A | `02_pods.py` | `PodLab` |
| 3 | `labels-and-api` | A | `03_labels_api.py` | `LabelsLab` |
| 4 | `deployments` | B | `04_deployments.py` | `RolloutLab` |
| 5 | `scheduling` | B | `05_scheduling.py` | `SchedulerLab` |
| 6 | `jobs-and-stateful` | B | `06_jobs_stateful.py` | `WorkloadsLab` |
| 7 | `services` (+ `ingress`) | C | `07_services.py`, `07b_ingress.py` | `ServiceLab`, `IngressLab` |
| 8 | `config-secrets` | C | `08_config_secrets.py` | `ConfigLab` |
| 9 | `storage` | C | `09_storage.py` | `StorageLab` |
| 10 | `control-plane` | D | `10_control_plane.py` | `ControlPlaneLab` |
| 11 | `node-inside` | D | `11_node_inside.py` | `NodeLab` |
| 12 | `crd-operator` | D | `12_crd_operator.py` (+ `operator_lab.py`) | `OperatorLab` |
| 13 | `rbac-security` | E | `13_rbac_security.py` | `SecurityLab` |
| 14 | `helm-and-ops` | E | `14_helm_hpa_debug.py` | `HelmLab`, `AutoscaleLab`, `DebugLab` |
| 15 | `capstone-pipeline` | E | `15_capstone_pipeline.py` | `PipelineLab` |

Every lesson has a quiz page (3 or 4 questions, Thai and English). Sixteen labs in all; every lab takes `lang`, shares `components/labs/devops/dv.tsx` and the `ib-` and `nw-` classes, and reads its numbers from a JSON file that an exercise wrote with `--write`.

## How it is checked

`code/verify.py` re-runs every exercise (16 files, 265 checks, about 25 minutes) against the `garden` minikube profile. `klab.py` labels what an exercise creates `klab=1` and uses its own kubeconfig (`code/out/garden.kubeconfig`), so the other minikube profiles and contexts of the computer are never touched. Setup:

```
minikube start -p garden --nodes 3 --driver=docker --container-runtime=containerd --kubernetes-version=v1.31.0 --cpus=2 --memory=2200
minikube addons enable ingress -p garden        # its Pods are pinned to the control plane: lift the taint while they start, then restore it
minikube addons enable metrics-server -p garden
```

## What the exercises found that a reader may not expect

- minikube does not put the usual `NoSchedule` taint on the control plane; `klab.ensure_cluster()` adds it so that the cluster behaves like a kubeadm one.
- `topologySpreadConstraints` with `maxSkew: 1` placed only 1 Pod per worker, because the tainted control plane counts as an empty domain; `nodeTaintsPolicy: Honor` fixed it.
- The default StorageClass makes `hostPath` volumes that live on the node where the Pod runs: a Pod on another node sees an empty folder, and deleting the PVC leaves the files on the worker.
- The ingress controller forwards the whole path and does not strip the prefix.
- minikube starts the scheduler and the controller manager with `--leader-elect=false`, so there is no leader Lease to look at.
- A node container stopped with `docker stop` needs `minikube start` again (the `/etc/hosts` line for the control plane is lost).
- kubectl on the owner's machine is a dispatcher that picks the client version that matches the server.
- The kubelet synced a changed ConfigMap into a mounted file after 86 s in one run and much faster in another.

## Not run (and why)

A managed cluster in a cloud, a real LoadBalancer or TLS in front of an Ingress, a CSI driver or a network disk, other CNIs than kindnet (Calico, Antrea), several control plane nodes, autoscaling by anything but CPU, an operator framework (Kubebuilder, Operator SDK), OPA Gatekeeper, encryption of Secrets in etcd, backup and upgrade of a cluster, and the Kubernetes source. These are the backlog of a second pass (an `in-depth` page on the scheduler's filter and score from the source, and a knowledge graph of the Kubernetes tree, were not started).
