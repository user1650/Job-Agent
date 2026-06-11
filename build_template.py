import os
from dotenv import load_dotenv
from e2b import Template, default_build_logger

load_dotenv()

dockerfile = """
FROM ubuntu:22.04

RUN apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*
"""

def main():
    api_key = os.getenv("E2B_API_KEY")
    if not api_key:
        print("E2B_API_KEY not found in environment.")
        return

    print("Building E2B LaTeX template...")
    try:
        template_builder = Template().from_dockerfile('template/e2b.Dockerfile')
        build_info = Template.build(
            template=template_builder,
            name='latex-resume-env',
            api_key=api_key
        )
        print("---------------------------------")
        print("BUILD SUCCESSFUL!")
        print(f"Template ID: {build_info.template_id}")
        
        # Now automatically update the .env file
        with open('.env', 'r') as f:
            lines = f.readlines()
        
        with open('.env', 'w') as f:
            for line in lines:
                if line.startswith('E2B_TEMPLATE_ID='):
                    f.write(f'E2B_TEMPLATE_ID={build_info.template_id}\n')
                else:
                    f.write(line)
                    
        print("Successfully updated E2B_TEMPLATE_ID in .env")
        
    except Exception as e:
        print("Build failed:", str(e))

if __name__ == "__main__":
    main()
