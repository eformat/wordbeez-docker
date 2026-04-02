{{/*
Common labels
*/}}
{{- define "wordswarm.labels" -}}
app.kubernetes.io/name: wordswarm
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "wordswarm.selectorLabels" -}}
app: wordswarm
app.kubernetes.io/name: wordswarm
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Secret name for MODEL_TOKEN
*/}}
{{- define "wordswarm.secretName" -}}
{{- if .Values.existingSecret -}}
{{ .Values.existingSecret }}
{{- else -}}
{{ .Release.Name }}-model-token
{{- end -}}
{{- end }}
