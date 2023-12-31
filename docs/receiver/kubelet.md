# Kubelet Stats Receiver

<!-- status autogenerated section -->
| Status        |           |
| ------------- |-----------|
| Stability     | [beta]: metrics   |
| Distributions | [contrib], [observiq], [splunk], [sumo] |
| Issues        | [![Open issues](https://img.shields.io/github/issues-search/open-telemetry/opentelemetry-collector-contrib?query=is%3Aissue%20is%3Aopen%20label%3Areceiver%2Fkubeletstats%20&label=open&color=orange&logo=opentelemetry)](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues?q=is%3Aopen+is%3Aissue+label%3Areceiver%2Fkubeletstats) [![Closed issues](https://img.shields.io/github/issues-search/open-telemetry/opentelemetry-collector-contrib?query=is%3Aissue%20is%3Aclosed%20label%3Areceiver%2Fkubeletstats%20&label=closed&color=blue&logo=opentelemetry)](https://github.com/open-telemetry/opentelemetry-collector-contrib/issues?q=is%3Aclosed+is%3Aissue+label%3Areceiver%2Fkubeletstats) |
| [Code Owners](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/CONTRIBUTING.md#becoming-a-code-owner)    | [@dmitryax](https://www.github.com/dmitryax), [@TylerHelmuth](https://www.github.com/TylerHelmuth) |

[beta]: https://github.com/open-telemetry/opentelemetry-collector#beta
[contrib]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-contrib
[observiq]: https://github.com/observIQ/observiq-otel-collector
[splunk]: https://github.com/signalfx/splunk-otel-collector
[sumo]: https://github.com/SumoLogic/sumologic-otel-collector
<!-- end autogenerated section -->

The Kubelet Stats Receiver pulls node, pod, container, and volume metrics from the API server on a kubelet
and sends it down the metric pipeline for further processing.

## Metrics

Details about the metrics produced by this receiver can be found in [metadata.yaml](./metadata.yaml) with further documentation in [documentation.md](./documentation.md)

## Configuration

A kubelet runs on a kubernetes node and has an API server to which this
receiver connects. To configure this receiver, you have to tell it how
to connect and authenticate to the API server and how often to collect data
and send it to the next consumer.

Kubelet Stats Receiver supports both secure Kubelet endpoint exposed at port 10250 by default and read-only
Kubelet endpoint exposed at port 10255. If `auth_type` set to `none`, the read-only endpoint will be used. The secure 
endpoint will be used if `auth_type` set to any of the following values:

- `tls` tells the receiver to use TLS for auth and requires that the fields
`ca_file`, `key_file`, and `cert_file` also be set.
- `serviceAccount` tells this receiver to use the default service account token
to authenticate to the kubelet API.
- `kubeConfig` tells this receiver to use the kubeconfig file (KUBECONFIG env variable or ~/.kube/config)
to authenticate and use API server proxy to access the kubelet API.
- `initial_delay` (default = `1s`): defines how long this receiver waits before starting.

### TLS Example

```yaml
receivers:
  kubeletstats:
    collection_interval: 20s
    initial_delay: 1s
    auth_type: "tls"
    ca_file: "/path/to/ca.crt"
    key_file: "/path/to/apiserver.key"
    cert_file: "/path/to/apiserver.crt"
    endpoint: "https://192.168.64.1:10250"
    insecure_skip_verify: true
exporters:
  file:
    path: "fileexporter.txt"
service:
  pipelines:
    metrics:
      receivers: [kubeletstats]
      exporters: [file]
```

### Service Account Authentication Example

Although it's possible to use kubernetes' hostNetwork feature to talk to the
kubelet api from a pod, the preferred approach is to use the downward API.

Make sure the pod spec sets the node name as follows:

```yaml
env:
  - name: K8S_NODE_NAME
    valueFrom:
      fieldRef:
        fieldPath: spec.nodeName
```

Then the otel config can reference the `K8S_NODE_NAME` environment variable:

```yaml
receivers:
  kubeletstats:
    collection_interval: 20s
    auth_type: "serviceAccount"
    endpoint: "https://${env:K8S_NODE_NAME}:10250"
    insecure_skip_verify: true
exporters:
  file:
    path: "fileexporter.txt"
service:
  pipelines:
    metrics:
      receivers: [kubeletstats]
      exporters: [file]
```

Note: a missing or empty `endpoint` will cause the hostname on which the
collector is running to be used as the endpoint. If the hostNetwork flag is
set, and the collector is running in a pod, this hostname will resolve to the
node's network namespace.

### Read Only Endpoint Example

The following config can be used to collect Kubelet metrics from read-only endpoint:

```yaml
receivers:
  kubeletstats:
    collection_interval: 20s
    auth_type: "none"
    endpoint: "http://${env:K8S_NODE_NAME}:10255"
exporters:
  file:
    path: "fileexporter.txt"
service:
  pipelines:
    metrics:
      receivers: [kubeletstats]
      exporters: [file]
```

### Kubeconfig example

The following config can be used to collect Kubelet metrics from read-only endpoint, proxied by the API server:

```yaml
receivers:
  kubeletstats:
    collection_interval: 20s
    auth_type: "kubeConfig"
    context: "my-context"
    insecure_skip_verify: true
    endpoint: "${env:K8S_NODE_NAME}"
exporters:
  file:
    path: "fileexporter.txt"
service:
  pipelines:
    metrics:
      receivers: [kubeletstats]
      exporters: [file]
```
Note that using `auth_type` `kubeConfig`, the endpoint should only be the node name as the communication to the kubelet is proxied by the API server configured in the `kubeConfig`.
`insecure_skip_verify` still applies by overriding the `kubeConfig` settings.
If no `context` is specified, the current context or the default context is used.

### Extra metadata labels

By default, all produced metrics get resource labels based on what kubelet /stats/summary endpoint provides.
For some use cases it might be not enough. So it's possible to leverage other endpoints to fetch
additional metadata entities and set them as extra labels on metric resource. Currently supported metadata
include the following:

- `container.id` - to augment metrics with Container ID label obtained from container statuses exposed via `/pods`.
- `k8s.volume.type` - to collect volume type from the Pod spec exposed via `/pods` and have it as a label on volume metrics.
If there's more information available from the endpoint than just volume type, those are sycned as well depending on
the available fields and the type of volume. For example, `aws.volume.id` would be synced from `awsElasticBlockStore`
and `gcp.pd.name` is synced for `gcePersistentDisk`.

If you want to have `container.id` label added to your metrics, use `extra_metadata_labels` field to enable
it, for example:

```yaml
receivers:
  kubeletstats:
    collection_interval: 10s
    auth_type: "serviceAccount"
    endpoint: "${env:K8S_NODE_NAME}:10250"
    insecure_skip_verify: true
    extra_metadata_labels:
      - container.id
```

If `extra_metadata_labels` is not set, no additional API calls is done to fetch extra metadata.

#### Collecting Additional Volume Metadata

When dealing with Persistent Volume Claims, it is possible to optionally sync metdadata from the underlying
storage resource rather than just the volume claim. This is achieved by talking to the Kubernetes API. Below
is an example, configuration to achieve this.

```yaml
receivers:
  kubeletstats:
    collection_interval: 10s
    auth_type: "serviceAccount"
    endpoint: "${env:K8S_NODE_NAME}:10250"
    insecure_skip_verify: true
    extra_metadata_labels:
      - k8s.volume.type
    k8s_api_config:
      auth_type: serviceAccount
```

If `k8s_api_config` set, the receiver will attempt to collect metadata from underlying storage resources for
Persistent Volume Claims. For example, if a Pod is using a PVC backed by an EBS instance on AWS, the receiver
would set the `k8s.volume.type` label to be `awsElasticBlockStore` rather than `persistentVolumeClaim`.

### Metric Groups

A list of metric groups from which metrics should be collected. By default, metrics from containers,
pods and nodes will be collected. If `metric_groups` is set, only metrics from the listed groups
will be collected. Valid groups are `container`, `pod`, `node` and `volume`. For example, if you're
looking to collect only `node` and `pod` metrics from the receiver use the following configuration.

```yaml
receivers:
  kubeletstats:
    collection_interval: 10s
    auth_type: "serviceAccount"
    endpoint: "${env:K8S_NODE_NAME}:10250"
    insecure_skip_verify: true
    metric_groups:
      - node
      - pod
```

### Optional parameters

The following parameters can also be specified:

- `collection_interval` (default = `10s`): The interval at which to collect data.
- `insecure_skip_verify` (default = `false`): Whether or not to skip certificate verification.

The full list of settings exposed for this receiver are documented [here](./config.go)
with detailed sample configurations [here](./testdata/config.yaml).

### Role-based access control

The Kubelet Stats Receiver needs `get` permissions on the `nodes/stats` resources. Additionally, when using `extra_metadata_labels` or any of the `{request|limit}_utilization` metrics the processor also needs `get` permissions for `nodes/proxy` resources.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: otel-collector
rules:
  - apiGroups: [""]
    resources: ["nodes/stats"]
    verbs: ["get"]
    
  # Only needed if you are using extra_metadata_labels or
  # are collecting the request/limit utilization metrics
  - apiGroups: [""]
    resources: ["nodes/proxy"]
    verbs: ["get"]
```

[comment]: <> (Code generated by mdatagen. DO NOT EDIT.)

# kubeletstats

## Default Metrics

The following metrics are emitted by default. Each of them can be disabled by applying the following configuration:

```yaml
metrics:
  <metric_name>:
    enabled: false
```

### container.cpu.time

Container CPU time

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| s | Sum | Double | Cumulative | true |

### container.cpu.utilization

Container CPU utilization

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### container.filesystem.available

Container filesystem available

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### container.filesystem.capacity

Container filesystem capacity

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### container.filesystem.usage

Container filesystem usage

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### container.memory.available

Container memory available

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### container.memory.major_page_faults

Container memory major_page_faults

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

### container.memory.page_faults

Container memory page_faults

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

### container.memory.rss

Container memory rss

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### container.memory.usage

Container memory usage

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### container.memory.working_set

Container memory working_set

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.node.cpu.time

Node CPU time

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| s | Sum | Double | Cumulative | true |

### k8s.node.cpu.utilization

Node CPU utilization

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.node.filesystem.available

Node filesystem available

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.node.filesystem.capacity

Node filesystem capacity

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.node.filesystem.usage

Node filesystem usage

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.node.memory.available

Node memory available

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.node.memory.major_page_faults

Node memory major_page_faults

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

### k8s.node.memory.page_faults

Node memory page_faults

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

### k8s.node.memory.rss

Node memory rss

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.node.memory.usage

Node memory usage

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.node.memory.working_set

Node memory working_set

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.node.network.errors

Node network errors

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| 1 | Sum | Int | Cumulative | true |

#### Attributes

| Name | Description | Values |
| ---- | ----------- | ------ |
| interface | Name of the network interface. | Any Str |
| direction | Direction of flow of bytes/operations (receive or transmit). | Str: ``receive``, ``transmit`` |

### k8s.node.network.io

Node network IO

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| By | Sum | Int | Cumulative | true |

#### Attributes

| Name | Description | Values |
| ---- | ----------- | ------ |
| interface | Name of the network interface. | Any Str |
| direction | Direction of flow of bytes/operations (receive or transmit). | Str: ``receive``, ``transmit`` |

### k8s.pod.cpu.time

Pod CPU time

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| s | Sum | Double | Cumulative | true |

### k8s.pod.cpu.utilization

Pod CPU utilization

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.pod.filesystem.available

Pod filesystem available

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.pod.filesystem.capacity

Pod filesystem capacity

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.pod.filesystem.usage

Pod filesystem usage

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.pod.memory.available

Pod memory available

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.pod.memory.major_page_faults

Pod memory major_page_faults

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

### k8s.pod.memory.page_faults

Pod memory page_faults

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

### k8s.pod.memory.rss

Pod memory rss

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.pod.memory.usage

Pod memory usage

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.pod.memory.working_set

Pod memory working_set

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.pod.network.errors

Pod network errors

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| 1 | Sum | Int | Cumulative | true |

#### Attributes

| Name | Description | Values |
| ---- | ----------- | ------ |
| interface | Name of the network interface. | Any Str |
| direction | Direction of flow of bytes/operations (receive or transmit). | Str: ``receive``, ``transmit`` |

### k8s.pod.network.io

Pod network IO

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| By | Sum | Int | Cumulative | true |

#### Attributes

| Name | Description | Values |
| ---- | ----------- | ------ |
| interface | Name of the network interface. | Any Str |
| direction | Direction of flow of bytes/operations (receive or transmit). | Str: ``receive``, ``transmit`` |

### k8s.volume.available

The number of available bytes in the volume.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.volume.capacity

The total capacity in bytes of the volume.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| By | Gauge | Int |

### k8s.volume.inodes

The total inodes in the filesystem.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

### k8s.volume.inodes.free

The free inodes in the filesystem.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

### k8s.volume.inodes.used

The inodes used by the filesystem. This may not equal inodes - free because filesystem may share inodes with other filesystems.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Int |

## Optional Metrics

The following metrics are not emitted by default. Each of them can be enabled by applying the following configuration:

```yaml
metrics:
  <metric_name>:
    enabled: true
```

### container.uptime

The time since the container started

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| s | Sum | Int | Cumulative | true |

### k8s.container.cpu_limit_utilization

Container cpu utilization as a ratio of the container's limits

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.container.cpu_request_utilization

Container cpu utilization as a ratio of the container's requests

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.container.memory_limit_utilization

Container memory utilization as a ratio of the container's limits

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.container.memory_request_utilization

Container memory utilization as a ratio of the container's requests

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.node.uptime

The time since the node started

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| s | Sum | Int | Cumulative | true |

### k8s.pod.cpu_limit_utilization

Pod cpu utilization as a ratio of the pod's total container limits. If any container is missing a limit the metric is not emitted.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.pod.cpu_request_utilization

Pod cpu utilization as a ratio of the pod's total container requests. If any container is missing a request the metric is not emitted.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.pod.memory_limit_utilization

Pod memory utilization as a ratio of the pod's total container limits. If any container is missing a limit the metric is not emitted.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.pod.memory_request_utilization

Pod memory utilization as a ratio of the pod's total container requests. If any container is missing a request the metric is not emitted.

| Unit | Metric Type | Value Type |
| ---- | ----------- | ---------- |
| 1 | Gauge | Double |

### k8s.pod.uptime

The time since the pod started

| Unit | Metric Type | Value Type | Aggregation Temporality | Monotonic |
| ---- | ----------- | ---------- | ----------------------- | --------- |
| s | Sum | Int | Cumulative | true |

## Resource Attributes

| Name | Description | Values | Enabled |
| ---- | ----------- | ------ | ------- |
| aws.volume.id | The id of the AWS Volume | Any Str | true |
| container.id | Container id used to identify container | Any Str | true |
| fs.type | The filesystem type of the Volume | Any Str | true |
| gce.pd.name | The name of the persistent disk in GCE | Any Str | true |
| glusterfs.endpoints.name | The endpoint name that details Glusterfs topology | Any Str | true |
| glusterfs.path | Glusterfs volume path | Any Str | true |
| k8s.container.name | Container name used by container runtime | Any Str | true |
| k8s.namespace.name | The name of the namespace that the pod is running in | Any Str | true |
| k8s.node.name | The name of the Node | Any Str | true |
| k8s.persistentvolumeclaim.name | The name of the Persistent Volume Claim | Any Str | true |
| k8s.pod.name | The name of the Pod | Any Str | true |
| k8s.pod.uid | The UID of the Pod | Any Str | true |
| k8s.volume.name | The name of the Volume | Any Str | true |
| k8s.volume.type | The type of the Volume | Any Str | true |
| partition | The partition in the Volume | Any Str | true |
