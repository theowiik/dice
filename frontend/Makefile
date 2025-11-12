.PHONY: help dev format ci docker-prod docker-dev docker-down docker-ci

.DEFAULT_GOAL := help

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  help        - Show this help message"
	@echo "  dev         - Run the development server"
	@echo "  format      - Format the code"
	@echo "  ci          - Run the CI checks"
	@echo ""
	@echo "Docker Targets:"
	@echo "  docker-dev  - Run development container"
	@echo "  docker-prod - Run production container"
	@echo "  docker-down - Stop all containers"
	@echo "  docker-ci   - Run CI checks in Docker"

dev:
	pnpm run dev

format:
	pnpm run format

ci:
	python3 ci_check.py

docker-dev:
	docker compose up --build dev

docker-prod:
	docker compose up -d --build prod

docker-down:
	docker compose down

docker-ci:
	docker compose build ci && docker compose run --rm ci
