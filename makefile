run:
	@if [ "$$(uname)" = "Linux" ] || [ "$$(uname)" = "Darwin" ]; then \
		echo "Running on Linux/Mac - starting development services..."; \
		./run_all_dev.sh; \
	elif [ "$$OS" = "Windows_NT" ]; then \
		echo "Running on Windows - starting development services..."; \
		run_all_dev.bat; \
	else \
		echo "Unsupported operating system: $$(uname)"; \
		exit 1; \
	fi