# Kubernetes: verified findings

Generated from the table at the end of each English lesson (`Where this lesson comes from`). Tags: **ran** = an exercise in `code/exercises/` asserts it, **book** = read in a book (section and printed page), **author** = advice, inference or something that was not run.
Everything marked ran was run on a 3 node minikube cluster (profile `garden`, Kubernetes v1.31.0, containerd 1.7.21, CNI kindnet, Docker driver on Docker Desktop with WSL2) with kubectl client v1.30.6 and Helm v3.13.3.

Counts: author 21, book 31, not run 1, ran 107

| Lesson | Claim | Tag | Source |
|---|---|---|---|
| 1. Why Kubernetes | The cluster has three nodes, one `control-plane`, all running Kubernetes v1.31.0 on `containerd` | ran | ran: `exercises/01_cluster.py` |
| 1. Why Kubernetes | `etcd`, `kube-apiserver`, `kube-controller-manager`, `kube-scheduler` run on the control plane, and every node has `kube-proxy` and `kindnet` | ran | ran: `exercises/01_cluster.py` |
| 1. Why Kubernetes | A Deployment with `replicas: 3` puts Pods on the two workers and not on the control plane | ran | ran: `exercises/01_cluster.py` |
| 1. Why Kubernetes | A deleted Pod is replaced by a Pod with a new name in about 2 seconds, and the events come from `replicaset-controller`, `default-scheduler`, `kubelet` | ran | ran: `exercises/01_cluster.py` |
| 1. Why Kubernetes | Changing `replicas` to 5 and then 2 with one command, and `spec` and `status` agree at the end | ran | ran: `exercises/01_cluster.py` |
| 1. Why Kubernetes | A stopped container is restarted by the kubelet in the same Pod (`restartCount` is 1) | ran | ran: `exercises/01_cluster.py` |
| 1. Why Kubernetes | A stopped node becomes NotReady after about 43 seconds and its Pods are created again on the worker that is left within 61 seconds (with `tolerationSeconds: 10`) | ran | ran: `exercises/01_cluster.py` |
| 1. Why Kubernetes | A node is declared NotReady after more than 40 seconds of silence, and Pods wait 300 seconds by default | author | author (Kubernetes defaults, not measured directly; the 40 seconds agrees with the measured time) |
| 1. Why Kubernetes | `containerd` is the low level runtime that Docker also uses, and the control plane does not rush to recreate Pods because it cannot tell a dead node from a brief network break | author | author (general understanding, not checked by a run) |
| 1. Why Kubernetes | Kubernetes solves infrastructure drift and keeps the rules of the system as YAML | book | book: Core Kubernetes section 1.2 page 2 and 1.4 page 5 |
| 1. Why Kubernetes | A cluster is a control plane and nodes, and every part talks through the API | book | book: Core Kubernetes section 1.6 page 9 and 2.3 page 29 |
| 2. Pod | Two containers of one Pod have the same IP and hostname (the IP of the Pod) and reach each other over `localhost` | ran | ran: `exercises/02_pods.py` |
| 2. Pod | A file in `/tmp` of one container does not appear in the other, and by default a container sees only its own processes | ran | ran: `exercises/02_pods.py` |
| 2. Pod | An `emptyDir` mounted in two containers shows the same file, and `shareProcessNamespace` shows each other's processes with `/pause` as PID 1 | ran | ran: `exercises/02_pods.py` |
| 2. Pod | An init container finishes before the main container starts, and the file it wrote can be read | ran | ran: `exercises/02_pods.py` |
| 2. Pod | A failing readiness probe makes the Pod Not Ready without a restart, a failing liveness probe restarts the container | ran | ran: `exercises/02_pods.py` |
| 2. Pod | A container over its memory limit is killed with OOMKilled and code 137 | ran | ran: `exercises/02_pods.py` |
| 2. Pod | The QoS classes are BestEffort, Burstable, Guaranteed, by what request and limit are set | ran | ran: `exercises/02_pods.py` |
| 2. Pod | `restartPolicy` Never leaves a Pod Failed or Succeeded, OnFailure restarts it, and a bare Pod that is deleted does not come back | ran | ran: `exercises/02_pods.py` |
| 2. Pod | 137 is 128 plus 9 (SIGKILL) | author | author (general Linux knowledge, not checked by a run) |
| 2. Pod | A Pod is a group of containers that share some namespaces, and what should live in one Pod | book | book: Core Kubernetes section 2.2 page 19 and Kubernetes Up and Running, Thinking with Pods, page 46 |
| 2. Pod | Liveness and readiness probes, requests and limits | book | book: Kubernetes Up and Running, Health Checks page 54 and Resource Management page 56 |
| 3. Labels, Namespaces and the API | An object has the top level keys apiVersion, kind, metadata, spec, status, and the API server adds uid, resourceVersion, creationTimestamp, namespace | ran | ran: `exercises/03_labels_api.py` |
| 3. Labels, Namespaces and the API | Six selectors pick Pods as the lab shows, and removing `app` from a2 takes it out of the selection | ran | ran: `exercises/03_labels_api.py` |
| 3. Labels, Namespaces and the API | The same name can live in two namespaces, and a new cluster has four namespaces | ran | ran: `exercises/03_labels_api.py` |
| 3. Labels, Namespaces and the API | Three `apply`s give created, unchanged, configured, a repeated `create` gives AlreadyExists, and an `apply` that changes nothing does not move resourceVersion | ran | ran: `exercises/03_labels_api.py` |
| 3. Labels, Namespaces and the API | `kubectl diff` exits with 1 when something differs, and `--dry-run=server` stores nothing | ran | ran: `exercises/03_labels_api.py` |
| 3. Labels, Namespaces and the API | `kubectl get --raw` gives the same object as `get -o json`, `/version` gives v1.31.0, and the API has 58 kinds in 19 groups in this cluster | ran | ran: `exercises/03_labels_api.py` |
| 3. Labels, Namespaces and the API | A namespace separates names, not the network | author | author (the NetworkPolicy results that were run are in the [lesson RBAC and security](/en/kubernetes/rbac-security/)) |
| 3. Labels, Namespaces and the API | Labels, selectors, and how Services and Deployments hook onto them | book | book: Kubernetes Up and Running, Labels page 65, Label Selectors page 68, Labels in the Kubernetes Architecture page 71 |
| 3. Labels, Namespaces and the API | API objects, and kubectl as an API caller | book | book: Kubernetes Up and Running, Viewing Kubernetes API Objects page 38, and Programming Kubernetes, The HTTP Interface of the API Server, page 20 |
| 4. Deployments and updates | A Pod is owned by a ReplicaSet and the ReplicaSet by a Deployment, with names built from the layer above | ran | ran: `exercises/04_deployments.py` |
| 4. Deployments and updates | A rolling update has at most 5 Pods and at least 3 Ready, and uses the full allowance | ran | ran: `exercises/04_deployments.py` |
| 4. Deployments and updates | The old ReplicaSet is kept at 0 and `rollout undo` reuses it as revision 3 | ran | ran: `exercises/04_deployments.py` |
| 4. Deployments and updates | Recreate has a moment with 0 Ready | ran | ran: `exercises/04_deployments.py` |
| 4. Deployments and updates | A bad image leaves new Pods in ImagePullBackOff, 3 old Pods Ready, the rollout at ProgressDeadlineExceeded, and undo repairs it | ran | ran: `exercises/04_deployments.py` |
| 4. Deployments and updates | If maxUnavailable equals the whole number of Pods, a rolling update becomes Recreate | author | author (inferred from what the values mean, not run) |
| 4. Deployments and updates | A ReplicaSet is the reconciliation loop of the Pod count, and a Deployment handles revision changes with several ReplicaSets | book | book: Kubernetes Up and Running, Reconciliation Loops page 104 and Deployment Internals page 114 |
| 4. Deployments and updates | The Recreate and RollingUpdate strategies with maxSurge and maxUnavailable | book | book: Kubernetes Up and Running, Deployment Strategies page 123 |
| 5. The scheduler and Pod placement | A Pod asking for 64 CPUs stays Pending with no node, and the event gives the number of nodes that failed for each reason | ran | ran: `exercises/05_scheduling.py` |
| 5. The scheduler and Pod placement | A worker has 15,900m of CPU free, and 6 Pods asking for 6360m are placed 2 per worker, 2 Pending | ran | ran: `exercises/05_scheduling.py` |
| 5. The scheduler and Pod placement | `nodeSelector` places a Pod on a labelled node | ran | ran: `exercises/05_scheduling.py` |
| 5. The scheduler and Pod placement | A NoSchedule taint makes an ordinary Pod Pending, a toleration allows it, running Pods are not evicted, and after the taint is removed the waiting Pod is placed by itself | ran | ran: `exercises/05_scheduling.py` |
| 5. The scheduler and Pod placement | `topologySpreadConstraints` first placed only 1 per worker and needed `nodeTaintsPolicy: Honor` to give 3 and 3 | ran | ran: `exercises/05_scheduling.py` |
| 5. The scheduler and Pod placement | cordon gives SchedulingDisabled and takes no new Pods, drain fails with a PodDisruptionBudget, and drain succeeds without it | ran | ran: `exercises/05_scheduling.py` |
| 5. The scheduler and Pod placement | The reason the control plane counts as a place with 0 Pods blocks the second one | author | author (inferred from the result and from Honor fixing it, the scheduler source was not read) |
| 5. The scheduler and Pod placement | The 1000m case in the lab (3 per worker) | author | author (computed the same way, not run) |
| 5. The scheduler and Pod placement | The scheduler chooses a node for a Pod through the API | book | book: Core Kubernetes, section 2.3 page 29 |
| 5. The scheduler and Pod placement | Requests decide placement, and the Automated Placement pattern | book | book: Kubernetes Up and Running, Resource Requests page 56 and Kubernetes Patterns, Automated Placement page 47 |
| 6. Job, CronJob, DaemonSet and StatefulSet | A Job with completions 6 and parallelism 2 has at most 2 Pods at once, ends Complete, and finished Pods are kept as Succeeded | ran | ran: `exercises/06_jobs_stateful.py` |
| 6. Job, CronJob, DaemonSet and StatefulSet | A Job with backoffLimit 2 and a program that always fails has 3 failed Pods and stops with BackoffLimitExceeded | ran | ran: `exercises/06_jobs_stateful.py` |
| 6. Job, CronJob, DaemonSet and StatefulSet | An every-minute CronJob makes a Job by itself within seconds, and `create job --from` gives a Job owned by the CronJob | ran | ran: `exercises/06_jobs_stateful.py` |
| 6. Job, CronJob, DaemonSet and StatefulSet | A DaemonSet puts Pods on both workers, none on the control plane, and does with a toleration | ran | ran: `exercises/06_jobs_stateful.py` |
| 6. Job, CronJob, DaemonSet and StatefulSet | A StatefulSet gives db-0 to db-2 in order, PVCs data-db-0 to 2, and a deleted db-1 returns with its name and data | ran | ran: `exercises/06_jobs_stateful.py` |
| 6. Job, CronJob, DaemonSet and StatefulSet | A Job should use restartPolicy Never or OnFailure | author | author (the meaning of the policies from the lesson on Pods, and common use) |
| 6. Job, CronJob, DaemonSet and StatefulSet | Batch Job, Periodic Job, Daemon Service and Stateful Service are separate patterns | book | book: Kubernetes Patterns, Batch Job page 63, Periodic Job page 69, Daemon Service page 73, Stateful Service page 87 |
| 6. Job, CronJob, DaemonSet and StatefulSet | Job Patterns, CronJobs and DaemonSet Scheduler | book | book: Kubernetes Up and Running, Job Patterns page 140, CronJobs page 150, DaemonSet Scheduler page 132 |
| 6. Job, CronJob, DaemonSet and StatefulSet | StatefulSets and storage | book | book: Kubernetes Up and Running, Kubernetes-Native Storage with StatefulSets page 186 |
| 7. Services and DNS | The ClusterIP is in 10.96.0.0/12 and is not a Pod IP, and the EndpointSlice equals the IPs of the Ready Pods | ran | ran: `exercises/07_services.py` |
| 7. Services and DNS | The short and the long Service name reach a Pod, and DNS answers the ClusterIP | ran | ran: `exercises/07_services.py` |
| 7. Services and DNS | `/etc/resolv.conf` has a search path starting with the Pod's namespace, `ndots:5`, and a nameserver that is the ClusterIP of `kube-dns` | ran | ran: `exercises/07_services.py` |
| 7. Services and DNS | 60 requests spread over three Pods, close but unequal | ran | ran: `exercises/07_services.py` |
| 7. Services and DNS | A Pod whose readiness fails leaves the EndpointSlice and gets no requests, but stays Running | ran | ran: `exercises/07_services.py` |
| 7. Services and DNS | A selector that matches nothing gives empty endpoints and Connection refused (about 1.3 s) | ran | ran: `exercises/07_services.py` |
| 7. Services and DNS | `iptables` has a rule for the ClusterIP, a chain per Service with statistic 0.33333 and 0.5, and DNAT to Pod:8080 | ran | ran: `exercises/07_services.py` |
| 7. Services and DNS | A NodePort answers on every node, including a node with no Pod, and a headless Service answers with Pod IPs | ran | ran: `exercises/07_services.py` |
| 7. Services and DNS | A headless Service suits callers who must choose the Pod | author | author (an observation from use and from the StatefulSet lesson, this point alone was not run) |
| 7. Services and DNS | Service Object, Service DNS, Endpoints and Looking Beyond the Cluster | book | book: Kubernetes Up and Running, The Service Object page 76, Service DNS page 77, Looking Beyond the Cluster page 79, Endpoints page 82 |
| 7. Services and DNS | kube-proxy and Services on iptables, and DNS of a Pod | book | book: Core Kubernetes, section 5.2 page 97 and section 10.3 page 200 |
| 8. ConfigMaps and Secrets | A ConfigMap reaches a Pod as a variable, a file mounted as a whole folder, and a `subPath` file | ran | ran: `exercises/08_config_secrets.py` |
| 8. ConfigMaps and Secrets | After a ConfigMap edit the file follows but the variable and the `subPath` file do not (the file followed after 86 seconds in the recorded run, faster in other runs) | ran | ran: `exercises/08_config_secrets.py` |
| 8. ConfigMaps and Secrets | An immutable ConfigMap refuses an edit of its data | ran | ran: `exercises/08_config_secrets.py` |
| 8. ConfigMaps and Secrets | A Secret shows as base64, decodes with one command, and `kubectl get -o yaml` does not hide it | ran | ran: `exercises/08_config_secrets.py` |
| 8. ConfigMaps and Secrets | The value of a Secret in etcd is plain text when no encryption provider is set | ran | ran: `exercises/08_config_secrets.py` |
| 8. ConfigMaps and Secrets | A Pod that names a missing key is stuck in CreateContainerConfigError with a message naming the key | ran | ran: `exercises/08_config_secrets.py` |
| 8. ConfigMaps and Secrets | Mounting as a file leaks less than passing a variable, and `immutable` lowers the load on the API server | author | author (general advice and understanding from documentation, not compared by a run) |
| 8. ConfigMaps and Secrets | ConfigMap and Secret as objects that reach a Pod in two ways | book | book: Kubernetes Up and Running, Using a ConfigMap page 154 and Secrets page 157 |
| 8. ConfigMaps and Secrets | etcd encryption at rest | book | book: Core Kubernetes, section 12.7 page 236 |
| 9. Volumes, PVCs and StorageClasses | The default StorageClass of minikube uses the provisioner `k8s.io/minikube-hostpath` and reclaimPolicy Delete, and a PVC is bound to a PV made for it before any Pod | ran | ran: `exercises/09_storage.py` |
| 9. Volumes, PVCs and StorageClasses | The PV is a hostPath folder with no nodeAffinity | ran | ran: `exercises/09_storage.py` |
| 9. Volumes, PVCs and StorageClasses | A file in a PVC survives a deleted Pod (on the same node), while an emptyDir is empty when recreated | ran | ran: `exercises/09_storage.py` |
| 9. Volumes, PVCs and StorageClasses | A Pod using the same claim on another node sees 0 files | ran | ran: `exercises/09_storage.py` |
| 9. Volumes, PVCs and StorageClasses | After a PVC is deleted (Delete) the PV is gone but the file on the worker stays | ran | ran: `exercises/09_storage.py` |
| 9. Volumes, PVCs and StorageClasses | A local PV with nodeAffinity and WaitForFirstConsumer makes the scheduler place the Pod on the node with the data, and Retain leaves the PV Released | ran | ran: `exercises/09_storage.py` |
| 9. Volumes, PVCs and StorageClasses | A PVC naming a StorageClass that does not exist stays Pending with an event | ran | ran: `exercises/09_storage.py` |
| 9. Volumes, PVCs and StorageClasses | The minikube provisioner cannot delete the file because it runs on the control plane | author | author (inferred from the result, the provisioner source was not read) |
| 9. Volumes, PVCs and StorageClasses | Network disks or CSI drivers let a Pod mount the disk from any node | book | book: Core Kubernetes, section 7.4 page 144 (not run) |
| 9. Volumes, PVCs and StorageClasses | PersistentVolume, PVC, StorageClass and dynamic provisioning | book | book: Core Kubernetes, section 8.1 page 153 and Kubernetes Up and Running, Dynamic Volume Provisioning page 185 |
| 10. Inside the control plane | The four manifests are in /etc/kubernetes/manifests and the Pods in kube-system are mirror Pods owned by the Node | ran | ran: `exercises/10_control_plane.py` |
| 10. Inside the control plane | The API server has `--etcd-servers` set, and every kind of data is a key under /registry (30 top level kinds) | ran | ran: `exercises/10_control_plane.py` |
| 10. Inside the control plane | A watch received the events ADDED, MODIFIED and DELETED from changing a Pod | ran | ran: `exercises/10_control_plane.py` |
| 10. Inside the control plane | An edit with an old resourceVersion is refused with Conflict and the value is not overwritten | ran | ran: `exercises/10_control_plane.py` |
| 10. Inside the control plane | With the scheduler stopped a Pod stays Pending with no node and no event, and is placed when the scheduler returns | ran | ran: `exercises/10_control_plane.py` |
| 10. Inside the control plane | With the controller manager stopped a deleted Pod is not replaced, replicas 5 is stored but not acted on, and the Deployment catches up when it returns | ran | ran: `exercises/10_control_plane.py` |
| 10. Inside the control plane | minikube uses `--leader-elect=false`, and node Leases are renewed about every 10 seconds | ran | ran: `exercises/10_control_plane.py` |
| 10. Inside the control plane | `--cascade=orphan` leaves the ReplicaSet and Pods, and deleting a ReplicaSet removes its Pods | ran | ran: `exercises/10_control_plane.py` |
| 10. Inside the control plane | Static Pods let the control plane start before there is an API server | author | author (inferred from the kubelet reading the manifest folder directly, not tested separately) |
| 10. Inside the control plane | The control plane, the API server, the scheduler and the controller manager | book | book: Core Kubernetes, section 11.1 page 206, 11.2 page 207, 11.3 page 214 |
| 10. Inside the control plane | etcd as the data store with watch support, and node Leases | book | book: Core Kubernetes, section 12.2 page 227 and section 9.3 page 180 |
| 10. Inside the control plane | Optimistic concurrency, and edge versus level driven triggers | book | book: Programming Kubernetes, page 14, and Edge- Versus Level-Driven Triggers, page 9 |
| 11. Inside a node | The kubelet is configured with the containerd socket and containerd is listening | ran | ran: `exercises/11_node_inside.py` |
| 11. Inside a node | A Pod is a sandbox running `/pause` plus our containers | ran | ran: `exercises/11_node_inside.py` |
| 11. Inside a node | Containers share one net namespace (1) and have separate mnt and pid (3) | ran | ran: `exercises/11_node_inside.py` |
| 11. Inside a node | `memory.max` 67108864, `cpu.max` `10000 100000`, `cpu.weight` 2, a container with no limit gets max, and a looping container is squeezed to about 10% (throttled every period) | ran | ran: `exercises/11_node_inside.py` |
| 11. Inside a node | A /24 Pod CIDR per node, a veth, routes to other nodes' CIDRs through the node IP, and the plugins ptp, host-local and portmap | ran | ran: `exercises/11_node_inside.py` |
| 11. Inside a node | ping TTL is 63 on the same node and 62 across nodes | ran | ran: `exercises/11_node_inside.py` |
| 11. Inside a node | Restarting the kubelet does not restart the containers (same ids and process, restartCount 0) | ran | ran: `exercises/11_node_inside.py` |
| 11. Inside a node | A kubelet can be upgraded without interrupting the service, and `containerd` is the same runtime that Docker uses inside | author | author (inferred from the run and from general understanding, an upgrade was not tried) |
| 11. Inside a node | The CRI and the pause container, QoS classes and the architecture of CNI | book | book: Core Kubernetes, section 9.3 pages 182 and 184, 9.4 page 185, 4.4 page 79, 4.5 page 83, 5.4 page 104 |
| 11. Inside a node | A Pod as a group of namespaces | book | book: Core Kubernetes, section 2.2 page 22 |
| 12. CRDs and operators | A CRD adds the kind Greeter to `api-resources`, and `kubectl explain` reads fields from the schema | ran | ran: `exercises/12_crd_operator.py` |
| 12. CRDs and operators | The schema refuses a `replicas` that is too high and a wrong data type, and stores nothing | ran | ran: `exercises/12_crd_operator.py` |
| 12. CRDs and operators | A Greeter with no operator is stored and shown with the columns we defined, but there is no Deployment, Pod or `status` | ran | ran: `exercises/12_crd_operator.py` |
| 12. CRDs and operators | A CRD object is a key in etcd at `/registry/<group>/<plural>/<namespace>/<name>` | ran | ran: `exercises/12_crd_operator.py` |
| 12. CRDs and operators | The operator creates a Deployment, repairs it when it is deleted (new uid), updates it when the `spec` changes, and its log is 2 creations and 1 update | ran | ran: `exercises/12_crd_operator.py` |
| 12. CRDs and operators | Deleting the Greeter while the operator is stopped garbage collects the Deployment through its `ownerReference` | ran | ran: `exercises/12_crd_operator.py` |
| 12. CRDs and operators | A real operator usually uses a watch and a framework | author | author (from the books and general understanding, the operator in this lesson is a polling script we wrote) |
| 12. CRDs and operators | Type definitions of a CRD (Type Definitions, Validating, Short Names, Printer Columns) | book | book: Programming Kubernetes, Type Definitions page 74, Validating Custom Resources page 76, Short Names and Categories page 78, Printer Columns page 80 |
| 12. CRDs and operators | The idea of an operator | book | book: Programming Kubernetes, Operators page 16 and Kubernetes Up and Running, Operators page 205 |
| 13. RBAC and security | Every Pod has `token`, `ca.crt`, `namespace`, and the default ServiceAccount gets 403 when it calls the API | ran | ran: `exercises/13_rbac_security.py` |
| 13. RBAC and security | A Role and RoleBinding allow list pods in one namespace, with the `can-i` results and the real calls giving 200 and 403 as in the table | ran | ran: `exercises/13_rbac_security.py` |
| 13. RBAC and security | `resourceNames` limits to one Secret, and `automountServiceAccountToken: false` removes the token | ran | ran: `exercises/13_rbac_security.py` |
| 13. RBAC and security | `runAsNonRoot` refuses an image that runs as root, and a Pod with five settings runs as uid 10001, cannot write to the file system and has no capabilities | ran | ran: `exercises/13_rbac_security.py` |
| 13. RBAC and security | Pod Security Admission at restricted refuses a privileged Pod and an ordinary Pod, admits a Pod with all settings, and does not touch existing Pods | ran | ran: `exercises/13_rbac_security.py` |
| 13. RBAC and security | NetworkPolicy: everything open with no policy, all closed when selected with no rule, only friend open, another namespace closed, and Pods not selected stay open | ran | ran: `exercises/13_rbac_security.py` |
| 13. RBAC and security | kindnet really enforces NetworkPolicy | ran | ran: `exercises/13_rbac_security.py` (seen from the blocking of Pods, not from kindnet's documentation) |
| 13. RBAC and security | A policy that sets only ingress does not limit the outward direction of a Pod | author | author (understanding from the meaning of `policyTypes`, this exact case was not run) |
| 13. RBAC and security | RBAC, Role, RoleBinding, `can-i` | book | book: Kubernetes Up and Running, Identity in Kubernetes page 168, Understanding Roles and Role Bindings page 169, Testing Authorization with can-i page 172 and Core Kubernetes, section 14.2 page 261 |
| 13. RBAC and security | The security context, not mounting the token, and NetworkPolicy | book | book: Core Kubernetes, section 13.3 pages 245 and 251 and section 14.4 page 269 |
| 13. RBAC and security | Pod Security Policy was removed and Pod Security Admission replaced it | author | author (general knowledge of recent Kubernetes, not checked against documentation in this lesson) |
| 14. Helm, autoscaling and finding why a Pod is broken | `helm lint` passes, `helm template` creates nothing in the cluster, and values go in the order defaults, then `-f`, then `--set` (2, 5, 7, 9) | ran | ran: `exercises/14_helm_hpa_debug.py` |
| 14. Helm, autoscaling and finding why a Pod is broken | `helm install` gives a release with the label managed-by Helm and a Secret per revision | ran | ran: `exercises/14_helm_hpa_debug.py` |
| 14. Helm, autoscaling and finding why a Pod is broken | upgrade gives revision 2, rollback gives revision 3 (the content of revision 1), and history does not go backwards | ran | ran: `exercises/14_helm_hpa_debug.py` |
| 14. Helm, autoscaling and finding why a Pod is broken | An upgrade with a wrong image fails and the release is failed while the old Pods stay ready, and a rollback repairs it | ran | ran: `exercises/14_helm_hpa_debug.py` |
| 14. Helm, autoscaling and finding why a Pod is broken | `helm uninstall` removes the Deployment, the Service and the Secrets of every revision | ran | ran: `exercises/14_helm_hpa_debug.py` |
| 14. Helm, autoscaling and finding why a Pod is broken | The HPA read 200% against a target of 50%, went from 1 to 4, and back to 1 after the load stopped | ran | ran: `exercises/14_helm_hpa_debug.py` |
| 14. Helm, autoscaling and finding why a Pod is broken | The symptoms ImagePullBackOff, CrashLoopBackOff, Pending and a Service with no endpoints, with the commands that reveal the cause | ran | ran: `exercises/14_helm_hpa_debug.py` |
| 14. Helm, autoscaling and finding why a Pod is broken | The symptoms CreateContainerConfigError and OOMKilled | ran | ran: `exercises/08_config_secrets.py` and `exercises/02_pods.py` |
| 14. Helm, autoscaling and finding why a Pod is broken | The scale down window of an HPA is normally 5 minutes | author | author (a Kubernetes default, not measured, the exercise sets 20 seconds) |
| 14. Helm, autoscaling and finding why a Pod is broken | The grouping of problems by Pod status in the last paragraph | author | author (a conclusion from the runs, not a complete list) |
| 14. Helm, autoscaling and finding why a Pod is broken | Charts, releases, values at install time and how releases are stored | book | book: Learning Helm, Resources, Installations, and Releases page 18, Configuration at Installation Time page 30 and How Helm Stores Release Information page 37 |
| 14. Helm, autoscaling and finding why a Pod is broken | The HPA and the checking commands | book | book: Kubernetes Patterns, Elastic Scale page 203, and Kubernetes Up and Running, Autoscaling a ReplicaSet page 110 and Debugging Commands page 40 |
| 15. Capstone, a data pipeline on Kubernetes | The StatefulSet database is ready and the PVC is bound | ran | ran: `exercises/15_capstone_pipeline.py` |
| 15. Capstone, a data pipeline on Kubernetes | The loader Job waits with an init container, loads the table and 1000 rows, and the log shows what is printed | ran | ran: `exercises/15_capstone_pipeline.py` |
| 15. Capstone, a data pipeline on Kubernetes | The second Job from the CronJob inserts 0 rows and the table stays at 1000 | ran | ran: `exercises/15_capstone_pipeline.py` |
| 15. Capstone, a data pipeline on Kubernetes | The loader runs as uid 70, with no privilege escalation, a read-only file system, drop ALL capabilities and no `env` | ran | ran: `exercises/15_capstone_pipeline.py` |
| 15. Capstone, a data pipeline on Kubernetes | A Pod without `role=loader` cannot reach the database (no response) | ran | ran: `exercises/15_capstone_pipeline.py` |
| 15. Capstone, a data pipeline on Kubernetes | A wrong Secret key in a volume gives FailedMount and the Job does not finish | ran | ran: `exercises/15_capstone_pipeline.py` |
| 15. Capstone, a data pipeline on Kubernetes | After `db-0` is deleted it returns within about 3 seconds with all 1000 rows | ran | ran: `exercises/15_capstone_pipeline.py` |
| 15. Capstone, a data pipeline on Kubernetes | A loader with `role=etl` stays at Init:0/1 with the waiting message, and with `role=loader` it finishes | ran | ran: `exercises/15_capstone_pipeline.py` |
| 15. Capstone, a data pipeline on Kubernetes | Work that can be retried must be idempotent | author | author (a general principle, and the exercise proves it only for the SQL of this loader) |
| 15. Capstone, a data pipeline on Kubernetes | Postgres starts as root and so fits only level baseline | author | author (understanding of the Postgres image, not checked by running restricted) |
| 15. Capstone, a data pipeline on Kubernetes | The password is in a temporary variable of the command and not in the `env` of the Pod | author | author (checked from the Job spec having no env, not checked that nothing inside leaks it elsewhere) |
| 71. Ingress | The controller is an ordinary Pod, and before any Ingress every request gets 404 | ran | ran: `exercises/07b_ingress.py` |
| 71. Ingress | The six requests gave the results in the table (rules by host and path, longest prefix wins, `/apix` does not match `/api`, a host with no rule gets the controller's 404) | ran | ran: `exercises/07b_ingress.py` |
| 71. Ingress | The controller sends the whole path without stripping the prefix | ran | ran: `exercises/07b_ingress.py` |
| 71. Ingress | The rules become `server_name` and destination names for Services in nginx.conf | ran | ran: `exercises/07b_ingress.py` |
| 71. Ingress | A Service with no Ready Pod gives 503 | ran | ran: `exercises/07b_ingress.py` |
| 71. Ingress | The Ingress spec is separate from the Ingress controller, Using Hostnames, Using Paths and Path Rewriting | book | book: Kubernetes Up and Running, Ingress Spec Versus Ingress Controllers page 90, Using Hostnames page 94, Using Paths page 95, Path Rewriting page 98 |
| 71. Ingress | A cloud LoadBalancer and TLS | not run | not run |
