/**
 * Geology MCP Server - Standards-Compliant Implementation
 * Domain-specific MCP server for geological analysis and well log processing
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

export interface GeologyMCPConfig {
  name: string;
  version: string;
  resourceRoot: string;
  dataPath?: string;
}

export class GeologyMCPServer {
  private server: McpServer;
  private resourceRoot: string;
  private dataPath: string;
  private initialized = false;

  constructor(config: GeologyMCPConfig) {
    this.resourceRoot = path.resolve(config.resourceRoot);
    this.dataPath = config.dataPath || path.join(this.resourceRoot, 'geology');
    
    // Create official MCP server with geological domain focus
    this.server = new McpServer({
      name: config.name,
      version: config.version
    });

    this.setupGeologyTools();
    this.setupGeologyResources();
    this.setupGeologyPrompts();
  }

  /**
   * Initialize geology MCP server and data directories
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.resourceRoot, { recursive: true });
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.setupGeologyDirectories();
      this.initialized = true;
      
      console.log(`🗻 Geology MCP Server "${this.server.name}" initialized`);
      console.log(`📁 Data path: ${this.dataPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize Geology MCP Server:', error);
      throw error;
    }
  }

  /**
   * Setup geology-specific MCP tools
   */
  private setupGeologyTools(): void {
    // Parse LAS file tool with geological focus
    this.server.registerTool(
      "parse_las_file",
      {
        title: "Parse LAS Well Log File",
        description: "Parse LAS well log files and extract geological formations data",
        inputSchema: {
          file_path: z.string().describe("Path to LAS file"),
          analysis_type: z.enum(["basic", "detailed", "formation_tops"]).default("basic"),
          depth_unit: z.enum(["ft", "m"]).default("ft").describe("Depth unit preference"),
          target_formations: z.array(z.string()).optional().describe("Specific formations to analyze")
        }
      },
      async ({ file_path, analysis_type, depth_unit, target_formations }) => {
        console.log(`🗻 Parsing LAS file: ${path.basename(file_path)} (${analysis_type})`);
        
        // Simulate real LAS parsing (would use actual LAS parser in production)
        const formations = [
          { name: "Bakken", top_depth: 10000, bottom_depth: 10120, unit: depth_unit, quality: "excellent" },
          { name: "Three Forks", top_depth: 10120, bottom_depth: 10500, unit: depth_unit, quality: "good" },
          { name: "Birdbear", top_depth: 10500, bottom_depth: 10800, unit: depth_unit, quality: "fair" }
        ];

        const curves = analysis_type === "detailed" ? 
          ["GR", "NPHI", "RHOB", "PE", "RT", "PHIE"] : 
          ["GR", "NPHI", "RHOB"];

        const result = {
          file_path,
          analysis_type,
          depth_unit,
          formations: target_formations ? 
            formations.filter(f => target_formations.includes(f.name)) : 
            formations,
          curves_available: curves,
          data_quality: "good",
          total_depth: 11000,
          spud_date: "2024-01-15",
          operator: "Ascendvent Energy",
          confidence: 0.88
        };

        // Save analysis to geology data directory
        const outputPath = path.join(this.dataPath, 'las-analysis', `${path.basename(file_path, '.las')}_analysis.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    );

    // Analyze formations tool
    this.server.registerTool(
      "analyze_formations",
      {
        title: "Analyze Geological Formations",
        description: "Perform detailed geological analysis of formations and recommend drilling targets",
        inputSchema: {
          formations: z.array(z.object({
            name: z.string(),
            top_depth: z.number(),
            bottom_depth: z.number(),
            unit: z.string(),
            quality: z.string()
          })),
          analysis_criteria: z.object({
            min_thickness: z.number().default(20).describe("Minimum formation thickness"),
            quality_threshold: z.enum(["poor", "fair", "good", "excellent"]).default("good"),
            target_type: z.enum(["oil", "gas", "mixed"]).default("oil")
          }).optional()
        }
      },
      async ({ formations, analysis_criteria = {} }) => {
        console.log(`🗻 Analyzing ${formations.length} formations for drilling potential`);
        
        const analysis = formations.map(formation => {
          const thickness = formation.bottom_depth - formation.top_depth;
          const qualityScore = { poor: 1, fair: 2, good: 3, excellent: 4 }[formation.quality] || 2;
          
          return {
            ...formation,
            thickness,
            net_pay_estimate: thickness * (qualityScore / 4) * 0.7,
            porosity_estimate: qualityScore * 0.08,
            permeability_estimate: qualityScore * 2.5,
            hydrocarbon_potential: qualityScore > 2 ? "high" : "moderate",
            drilling_recommendation: qualityScore >= 3 && thickness >= (analysis_criteria.min_thickness || 20) ? "RECOMMEND" : "EVALUATE"
          };
        });

        const primaryTarget = analysis.find(f => f.drilling_recommendation === "RECOMMEND");
        
        const summary = {
          total_formations: formations.length,
          recommended_targets: analysis.filter(f => f.drilling_recommendation === "RECOMMEND").length,
          primary_target: primaryTarget?.name || "None identified",
          total_net_pay: analysis.reduce((sum, f) => sum + f.net_pay_estimate, 0),
          analysis_criteria,
          formations: analysis,
          risk_assessment: primaryTarget ? "Low to Moderate" : "High",
          next_steps: primaryTarget ? 
            ["Proceed with drilling planning", "Conduct detailed petrophysical analysis"] :
            ["Acquire additional seismic data", "Evaluate alternative formations"]
        };

        // Save formation analysis
        const outputPath = path.join(this.dataPath, 'formation-analysis', `analysis_${Date.now()}.json`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

        return {
          content: [{
            type: "text", 
            text: JSON.stringify(summary, null, 2)
          }]
        };
      }
    );

    // Generate zones GeoJSON tool
    this.server.registerTool(
      "generate_zones_geojson",
      {
        title: "Generate Geological Zones GeoJSON",
        description: "Create GeoJSON file with geological zone boundaries and formation data",
        inputSchema: {
          formations: z.array(z.object({
            name: z.string(),
            top_depth: z.number(),
            bottom_depth: z.number(),
            unit: z.string()
          })),
          well_location: z.object({
            latitude: z.number(),
            longitude: z.number(),
            surface_elevation: z.number().optional()
          }).optional(),
          zone_buffer: z.number().default(1000).describe("Buffer around well location in meters")
        }
      },
      async ({ formations, well_location, zone_buffer }) => {
        console.log(`🗻 Generating zones GeoJSON for ${formations.length} formations`);
        
        // Default location if not provided (Bakken region)
        const location = well_location || { latitude: 47.7511, longitude: -101.7778 };
        
        const features = formations.map((formation, index) => ({
          type: "Feature",
          properties: {
            name: formation.name,
            top_depth: formation.top_depth,
            bottom_depth: formation.bottom_depth,
            thickness: formation.bottom_depth - formation.top_depth,
            depth_unit: formation.unit,
            formation_order: index + 1,
            created_by: "Marcus Aurelius Geologicus",
            created_at: new Date().toISOString()
          },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [location.longitude - 0.01, location.latitude - 0.01],
              [location.longitude + 0.01, location.latitude - 0.01], 
              [location.longitude + 0.01, location.latitude + 0.01],
              [location.longitude - 0.01, location.latitude + 0.01],
              [location.longitude - 0.01, location.latitude - 0.01]
            ]]
          }
        }));

        const geoJson = {
          type: "FeatureCollection",
          metadata: {
            name: "Geological Zones",
            well_location: location,
            total_formations: formations.length,
            depth_unit: formations[0]?.unit || "ft",
            zone_buffer_meters: zone_buffer,
            generated_by: "Geology MCP Server",
            generated_at: new Date().toISOString()
          },
          features
        };

        // Save GeoJSON to geology data directory
        const outputPath = path.join(this.dataPath, 'zones', 'zones.geojson');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(geoJson, null, 2));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(geoJson, null, 2)
          }]
        };
      }
    );
  }

  /**
   * Setup geology-specific MCP resources
   */
  private setupGeologyResources(): void {
    // Geological formations resource
    this.server.registerResource(
      "geological_formations",
      new ResourceTemplate("geology://formations/{formation_name}", { list: ["bakken", "three_forks", "birdbear"] }),
      {
        title: "Geological Formations Database",
        description: "Formation data including lithology, thickness, and hydrocarbon potential"
      },
      async (uri, { formation_name }) => {
        const formationPath = path.join(this.dataPath, 'formations', `${formation_name}.json`);
        
        try {
          const content = await fs.readFile(formationPath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'application/json'
            }]
          };
        } catch (error) {
          // Return default formation data if file doesn't exist
          const defaultData = {
            name: formation_name,
            type: "sedimentary",
            age: "devonian_mississippian",
            typical_depth: "10000-11000 ft",
            hydrocarbon_type: "oil_gas",
            notes: `Default data for ${formation_name} formation`
          };
          
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(defaultData, null, 2),
              mimeType: 'application/json'
            }]
          };
        }
      }
    );

    // LAS files resource  
    this.server.registerResource(
      "las_well_logs",
      new ResourceTemplate("geology://las/{well_name}", { list: undefined }),
      {
        title: "LAS Well Log Files",
        description: "Well log data in LAS format for geological analysis"
      },
      async (uri, { well_name }) => {
        const lasPath = path.join(this.dataPath, 'las-files', `${well_name}.las`);
        
        try {
          const content = await fs.readFile(lasPath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'application/x-las'
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `# LAS file not found: ${well_name}.las\n# Use geology MCP server to parse available LAS files`,
              mimeType: 'text/plain'
            }]
          };
        }
      }
    );

    // Zones GeoJSON resource
    this.server.registerResource(
      "geological_zones",
      new ResourceTemplate("geology://zones/geojson", { list: ["zones.geojson"] }),
      {
        title: "Geological Zone Boundaries",
        description: "GeoJSON files with geological zone boundaries and formation data"
      },
      async (uri) => {
        const zonesPath = path.join(this.dataPath, 'zones', 'zones.geojson');
        
        try {
          const content = await fs.readFile(zonesPath, 'utf8');
          return {
            contents: [{
              uri: uri.href,
              text: content,
              mimeType: 'application/geo+json'
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: '{"type": "FeatureCollection", "features": [], "metadata": {"error": "No zones generated yet"}}',
              mimeType: 'application/geo+json'
            }]
          };
        }
      }
    );
  }

  /**
   * Setup geology-specific MCP prompts  
   */
  private setupGeologyPrompts(): void {
    this.server.registerPrompt(
      "geological_analysis_prompt",
      {
        title: "Geological Analysis Prompt",
        description: "Template for geological formation analysis and recommendations"
      },
      async ({ formation_data, analysis_type = "standard" }) => {
        const prompt = `You are Marcus Aurelius Geologicus, a Roman imperial geologist with expertise in oil and gas exploration.

FORMATION DATA:
${JSON.stringify(formation_data, null, 2)}

ANALYSIS TYPE: ${analysis_type}

INSTRUCTIONS:
1. Analyze the geological formations for hydrocarbon potential
2. Identify primary and secondary drilling targets
3. Assess risks and recommend next steps
4. Present findings in a clear, professional geological report
5. Include confidence intervals and data quality assessments

RESPONSE FORMAT:
- Executive Summary (2-3 sentences)
- Formation Analysis (detailed breakdown)
- Risk Assessment (geological and operational)
- Recommendations (drilling targets and next steps)
- Data Quality Notes

Remember: Maintain imperial Roman persona while providing modern geological expertise.`;

        return {
          description: "Geological analysis prompt with formation data",
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: prompt
            }
          }]
        };
      }
    );

    this.server.registerPrompt(
      "las_interpretation_prompt", 
      {
        title: "LAS Log Interpretation Prompt",
        description: "Template for interpreting well log curves and identifying formations"
      },
      async ({ las_curves, depth_range, target_formations = [] }) => {
        const prompt = `You are Marcus Aurelius Geologicus, analyzing well log data with imperial precision.

WELL LOG CURVES:
${JSON.stringify(las_curves, null, 2)}

DEPTH RANGE: ${depth_range}
TARGET FORMATIONS: ${target_formations.join(", ") || "All available"}

ANALYSIS INSTRUCTIONS:
1. Interpret gamma ray (GR) curve for shale/sand identification
2. Use neutron-density curves to identify porosity and lithology
3. Identify formation tops and contacts
4. Assess net-to-gross ratios
5. Identify potential hydrocarbon-bearing intervals
6. Provide petrophysical parameter estimates

DELIVERABLES:
- Formation tops picks with confidence
- Lithology interpretation
- Porosity and permeability estimates  
- Hydrocarbon indicators
- Quality control notes

Apply Roman discipline to modern log analysis techniques.`;

        return {
          description: "LAS log interpretation prompt with curve data",
          messages: [{
            role: "user", 
            content: {
              type: "text",
              text: prompt
            }
          }]
        };
      }
    );
  }

  /**
   * Setup geological data directory structure
   */
  private async setupGeologyDirectories(): Promise<void> {
    const dirs = [
      'formations',
      'las-files', 
      'las-analysis',
      'formation-analysis',
      'zones',
      'reports',
      'qc-data'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataPath, dir), { recursive: true });
    }
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Connect server to a transport
   */
  async connect(transport: any): Promise<void> {
    await this.server.connect(transport);
  }

  /**
   * Shutdown the geology MCP server
   */
  async shutdown(): Promise<void> {
    try {
      this.initialized = false;
      console.log('🗻 Geology MCP Server shutdown complete');
    } catch (error) {
      console.error('❌ Error during geology server shutdown:', error);
    }
  }
}