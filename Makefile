AWS_PROFILE ?= sandbox
REGION ?= eu-west-1

.PHONY: create delete

## Create a temporary IAM user for a candidate: make create name=<candidate-name>
create:
ifndef name
	$(error name is required. Usage: make create name=<candidate-name>)
endif
	@echo "Creating IAM user: candidate-$(name)"
	aws iam create-user --user-name candidate-$(name) --profile $(AWS_PROFILE) --region $(REGION)
	@echo "Attaching PowerUserAccess policy..."
	aws iam attach-user-policy --user-name candidate-$(name) \
		--policy-arn arn:aws:iam::aws:policy/PowerUserAccess \
		--profile $(AWS_PROFILE) --region $(REGION)
	@echo "Attaching IAMFullAccess policy..."
	aws iam attach-user-policy --user-name candidate-$(name) \
		--policy-arn arn:aws:iam::aws:policy/IAMFullAccess \
		--profile $(AWS_PROFILE) --region $(REGION)
	@echo "Creating access keys..."
	@aws iam create-access-key --user-name candidate-$(name) \
		--profile $(AWS_PROFILE) --region $(REGION) \
		--query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text | \
		while read key secret; do \
			echo "AWS_ACCESS_KEY_ID=$$key" > .env; \
			echo "AWS_SECRET_ACCESS_KEY=$$secret" >> .env; \
			echo "AWS_REGION=$(REGION)" >> .env; \
		done
	@echo ""
	@echo "Done! Credentials written to .env"
	@cat .env

## Delete a temporary IAM user and clean up: make delete name=<candidate-name>
delete:
ifndef name
	$(error name is required. Usage: make delete name=<candidate-name>)
endif
	@echo "Cleaning up IAM user: candidate-$(name)"
	@echo "Deleting access keys..."
	@aws iam list-access-keys --user-name candidate-$(name) \
		--profile $(AWS_PROFILE) --region $(REGION) \
		--query 'AccessKeyMetadata[].AccessKeyId' --output text | \
		tr '\t' '\n' | while read key; do \
			[ -n "$$key" ] && aws iam delete-access-key --user-name candidate-$(name) \
				--access-key-id $$key --profile $(AWS_PROFILE) --region $(REGION); \
		done
	@echo "Detaching policies..."
	-aws iam detach-user-policy --user-name candidate-$(name) \
		--policy-arn arn:aws:iam::aws:policy/PowerUserAccess \
		--profile $(AWS_PROFILE) --region $(REGION)
	-aws iam detach-user-policy --user-name candidate-$(name) \
		--policy-arn arn:aws:iam::aws:policy/IAMFullAccess \
		--profile $(AWS_PROFILE) --region $(REGION)
	@echo "Deleting user..."
	aws iam delete-user --user-name candidate-$(name) \
		--profile $(AWS_PROFILE) --region $(REGION)
	@echo "Done! User candidate-$(name) has been removed."
