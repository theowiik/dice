.PHONY: help ci format

help:
	@echo "Usage:"
	@echo "  make format    - Format code with Biome"
	@echo "  make ci        - Run CI checks"
	@echo "  make docker-ci - Run CI checks in docker"

format:
	pnpm run format

ci:
	python3 ci_check.py

docker-ci:
	docker compose build ci && docker compose run --rm ci
