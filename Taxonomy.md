shale-yeah/
├─ README.md
├─ LICENSE
├─ package.json
├─ .claude-flow/
│  ├─ CLAUDE.md
│  ├─ swarm.yaml
│  ├─ agents/
│  │  ├─ geowiz.yaml
│  │  ├─ curve-smith.yaml
│  │  ├─ reporter.yaml
│  │  └─ data-loader.yaml
│  └─ tools/
│     ├─ las-parse.ts
│     ├─ curve-fit.ts
│     ├─ geojson-utils.ts
│     └─ s3-io.ts
├─ specs/                # human-writable mini specs that generate agents
│  ├─ geowiz.spec.md
│  ├─ curve-smith.spec.md
│  └─ reporter.spec.md
├─ pipelines/
│  └─ shale.yaml         # orchestrated multi-agent flow
├─ data/
│  ├─ samples/           # tiny public LAS/CSV shapefiles to avoid lic issues
│  └─ outputs/
├─ scripts/
│  ├─ generate-from-spec.ts
│  ├─ run-local.sh
│  └─ demo.sh
└─ CONTRIBUTING.md