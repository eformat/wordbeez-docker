# Image URLs for building/pushing image targets
REGISTRY ?= quay.io
REPOSITORY ?= $(REGISTRY)/eformat/wordswarm

GAME_IMG := $(REPOSITORY)-game:latest
AGENT_IMG := $(REPOSITORY)-agent:latest

PODMAN_ARGS ?=
POD_NAME ?= wordswarm

# --- Build ---

podman-build: podman-build-game podman-build-agent

podman-build-game:
	podman build $(PODMAN_ARGS) . -t $(GAME_IMG) -f wordswarm-next/Containerfile

podman-build-agent:
	podman build $(PODMAN_ARGS) wordswarm-agent -t $(AGENT_IMG) -f wordswarm-agent/Containerfile

# --- Push ---

podman-login:
	@podman login -u $(DOCKER_USER) -p $(DOCKER_PASSWORD) $(REGISTRY)

podman-push: podman-push-game podman-push-agent

podman-push-game:
	podman push $(GAME_IMG)

podman-push-agent:
	podman push $(AGENT_IMG)

# --- Run locally in a pod ---

podman-run: podman-stop
	podman pod create --name $(POD_NAME) -p 8080:8080
	podman run -d --pod $(POD_NAME) --name $(POD_NAME)-game \
		-e MODEL_TOKEN="$${MODEL_TOKEN}" \
		-v wordswarm-data:/data:Z \
		$(GAME_IMG)
	podman run -d --pod $(POD_NAME) --name $(POD_NAME)-agent \
		-e GAME_URL=http://localhost:8080 \
		-e MODEL_TOKEN="$${MODEL_TOKEN}" \
		$(AGENT_IMG)

podman-run-game: podman-stop
	podman pod create --name $(POD_NAME) -p 8080:8080
	podman run -d --pod $(POD_NAME) --name $(POD_NAME)-game \
		-e MODEL_TOKEN="$${MODEL_TOKEN}" \
		-v wordswarm-data:/data:Z \
		$(GAME_IMG)

podman-stop:
	-podman pod rm -f $(POD_NAME) 2>/dev/null

podman-logs-game:
	podman logs -f $(POD_NAME)-game

podman-logs-agent:
	podman logs -f $(POD_NAME)-agent

# --- Helm ---

CHART_DIR := chart/wordswarm
RELEASE_NAME ?= wordswarm
NAMESPACE ?= wordswarm

helm-install:
	helm upgrade --install $(RELEASE_NAME) $(CHART_DIR) \
		--namespace $(NAMESPACE) --create-namespace \
		--set modelToken="$${MODEL_TOKEN}"

helm-uninstall:
	helm uninstall $(RELEASE_NAME) --namespace $(NAMESPACE)

helm-template:
	helm template $(RELEASE_NAME) $(CHART_DIR) --set modelToken="$${MODEL_TOKEN}"

# --- All-in-one ---

all: podman-build podman-push

.PHONY: podman-build podman-build-game podman-build-agent \
	podman-login podman-push podman-push-game podman-push-agent \
	podman-run podman-stop podman-logs-game podman-logs-agent \
	helm-install helm-uninstall helm-template all
