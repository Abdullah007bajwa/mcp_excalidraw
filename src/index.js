import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import {
  elements,
  generateId,
  EXCALIDRAW_ELEMENT_TYPES
} from './types.js';
import fs from 'fs/promises'; // ADDED: Import file system promises API

// Load environment variables
dotenv.config();

// In-memory storage for scene state
const sceneState = {
  theme: 'light',
  viewBackgroundColor: '#ffffff', // ADDED: Common AppState property
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedElements: new Set(),
  groups: new Map()
};

// Schema definitions using zod
const ElementSchema = z.object({
  type: z.enum(Object.values(EXCALIDRAW_ELEMENT_TYPES)),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
  backgroundColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  roughness: z.number().optional(),
  opacity: z.number().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.number().optional(),
  locked: z.boolean().optional() // ADDED: Make sure locked status is saved
});

const ElementIdSchema = z.object({
  id: z.string()
});

const ElementIdsSchema = z.object({
  elementIds: z.array(z.string())
});

const GroupIdSchema = z.object({
  groupId: z.string()
});

const AlignElementsSchema = z.object({
  elementIds: z.array(z.string()),
  alignment: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom'])
});

const DistributeElementsSchema = z.object({
  elementIds: z.array(z.string()),
  direction: z.enum(['horizontal', 'vertical'])
});

const QuerySchema = z.object({
  type: z.enum(Object.values(EXCALIDRAW_ELEMENT_TYPES)).optional(),
  filter: z.record(z.any()).optional()
});

const ResourceSchema = z.object({
  resource: z.enum(['scene', 'library', 'theme', 'elements'])
});

// ADDED: Schema for the new save_scene tool
const SaveSceneSchema = z.object({
  filename: z.string().optional().describe("Optional filename ending with .excalidraw (default: mcp_scene.excalidraw)")
});

// Initialize MCP server
const server = new Server(
  {
    name: "excalidraw-mcp-server",
    version: "1.0.0",
    description: "MCP server for Excalidraw"
  },
  {
    capabilities: {
      tools: {
        create_element: {
          description: 'Create a new Excalidraw element',
          inputSchema: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) 
              },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              backgroundColor: { type: 'string' },
              strokeColor: { type: 'string' },
              strokeWidth: { type: 'number' },
              roughness: { type: 'number' },
              opacity: { type: 'number' },
              text: { type: 'string' },
              fontSize: { type: 'number' },
              fontFamily: { type: 'string' }
            },
            required: ['type', 'x', 'y']
          }
        },
        update_element: {
          description: 'Update an existing Excalidraw element',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { 
                type: 'string', 
                enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) 
              },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              backgroundColor: { type: 'string' },
              strokeColor: { type: 'string' },
              strokeWidth: { type: 'number' },
              roughness: { type: 'number' },
              opacity: { type: 'number' },
              text: { type: 'string' },
              fontSize: { type: 'number' },
              fontFamily: { type: 'string' }
            },
            required: ['id']
          }
        },
        delete_element: {
          description: 'Delete an Excalidraw element',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' }
            },
            required: ['id']
          }
        },
        query_elements: {
          description: 'Query Excalidraw elements with optional filters',
          inputSchema: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) 
              },
              filter: { 
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        get_resource: {
          description: 'Get an Excalidraw resource',
          inputSchema: {
            type: 'object',
            properties: {
              resource: { 
                type: 'string', 
                enum: ['scene', 'library', 'theme', 'elements'] 
              }
            },
            required: ['resource']
          }
        },
        group_elements: {
          description: 'Group multiple elements together',
          inputSchema: {
            type: 'object',
            properties: {
              elementIds: { 
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['elementIds']
          }
        },
        ungroup_elements: {
          description: 'Ungroup a group of elements',
          inputSchema: {
            type: 'object',
            properties: {
              groupId: { type: 'string' }
            },
            required: ['groupId']
          }
        },
        align_elements: {
          description: 'Align elements to a specific position',
          inputSchema: {
            type: 'object',
            properties: {
              elementIds: { 
                type: 'array',
                items: { type: 'string' }
              },
              alignment: { 
                type: 'string', 
                enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'] 
              }
            },
            required: ['elementIds', 'alignment']
          }
        },
        distribute_elements: {
          description: 'Distribute elements evenly',
          inputSchema: {
            type: 'object',
            properties: {
              elementIds: { 
                type: 'array',
                items: { type: 'string' }
              },
              direction: { 
                type: 'string', 
                enum: ['horizontal', 'vertical'] 
              }
            },
            required: ['elementIds', 'direction']
          }
        },
        lock_elements: {
          description: 'Lock elements to prevent modification',
          inputSchema: {
            type: 'object',
            properties: {
              elementIds: { 
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['elementIds']
          }
        },
        unlock_elements: {
          description: 'Unlock elements to allow modification',
          inputSchema: {
            type: 'object',
            properties: {
              elementIds: { 
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['elementIds']
          }
        },

        // ADDED: Definition for the save_scene tool
        save_scene: {
          description: 'Saves the current Excalidraw elements and scene state to a .excalidraw file.',
          inputSchema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Optional filename ending with .excalidraw (default: mcp_scene.excalidraw)'
              }
            }
          }
        }
      }
    }
  }
);

// Set up request handler for tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    logger.info(`Handling tool call: ${name}`);

    switch (name) {
      case 'create_element': {
        if (args.fontFamily && typeof args.fontFamily === 'string') {
          const fontMap = { "virgil": 1, "helvetica": 2, "cascadia": 3 };
          args.fontFamily = fontMap[args.fontFamily.toLowerCase()] ?? 1;
        }
      
        const params = ElementSchema.passthrough().parse(args);
        const id = generateId();
        const now = Date.now();
        const seed = Math.floor(Math.random() * 2 ** 31);
        const versionNonce = Math.floor(Math.random() * 2 ** 31);
      
        const element = {
          id,
          type: params.type,
          x: params.x,
          y: params.y,
          width: params.width ?? 10,
          height: params.height ?? 10,
          seed,
          version: 1,
          versionNonce,
          isDeleted: false,
          locked: params.locked ?? false,
          angle: params.angle ?? 0,
          fillStyle: params.fillStyle ?? 'hachure',
          strokeWidth: params.strokeWidth ?? 1,
          strokeStyle: params.strokeStyle ?? 'solid',
          roughness: params.roughness ?? 1,
          opacity: params.opacity !== undefined ? Math.max(0, Math.min(100, params.opacity * 100)) : 100,
          groupIds: [],
          frameId: null,
          roundness: params.roundness ?? null,
          boundElements: null,
          link: null,
          updated: now,
          strokeColor: params.strokeColor ?? '#000000',
          backgroundColor: params.backgroundColor ?? 'transparent',
          text: params.text ?? '',
          fontSize: params.fontSize ?? 20,
          fontFamily: params.fontFamily ?? 1,
          textAlign: params.textAlign ?? 'center',
          verticalAlign: params.verticalAlign ?? 'middle',
          containerId: null,
          originalText: params.text ?? '',
          points: params.points,
          startBinding: null,
          endBinding: null,
          lastCommittedPoint: null,
          startArrowhead: null,
          endArrowhead: null,
          fileId: null,
          scale: [1, 1],
          status: 'saved',
        };
      
        if ((element.type === 'arrow' || element.type === 'line') && (!element.points || element.points.length < 2)) {
          element.points = [[0, 0], [element.width || 10, element.height || 0]];
          if (element.type === 'arrow') {
            element.startArrowhead = element.startArrowhead ?? null;
            element.endArrowhead = element.endArrowhead ?? 'arrow';
          }
        }
      
        Object.keys(element).forEach(key => {
          if (element[key] === undefined) delete element[key];
        });
      
        elements.set(id, element);
        return {
          content: [{ type: 'text', text: JSON.stringify({ id: element.id, type: element.type, created: true }, null, 2) }]
        };
      }
      
      case 'update_element': {
        const rawParams = ElementSchema.partial().extend({ id: ElementIdSchema.shape.id }).passthrough().parse(args);
        const { id, ...updates } = rawParams;
      
        if (!id) throw new Error('Element ID is required');
      
        const existingElement = elements.get(id);
        if (!existingElement) throw new Error(`Element with ID ${id} not found`);
      
        if (typeof updates.fontFamily === 'string') {
          const fontMap = { "virgil": 1, "helvetica": 2, "cascadia": 3 };
          updates.fontFamily = fontMap[updates.fontFamily.toLowerCase()] ?? existingElement.fontFamily;
        }
      
        if (updates.opacity !== undefined) {
          updates.opacity = Math.max(0, Math.min(100, updates.opacity * 100));
        }
      
        const potentialNewElement = {
          ...existingElement,
          ...updates,
          version: (existingElement.version || 0) + 1,
          versionNonce: Math.floor(Math.random() * 2 ** 31),
          updated: Date.now()
        };
      
        Object.keys(potentialNewElement).forEach(key => {
          if (key === 'createdAt' || key === 'updatedAt') delete potentialNewElement[key];
        });
      
        elements.set(id, potentialNewElement);
        logger.info(`Element ${id} updated.`);
        logger.debug('Stored element data after update:', potentialNewElement);
      
        return {
          content: [{ type: 'text', text: JSON.stringify({ id: potentialNewElement.id, updated: true, version: potentialNewElement.version }, null, 2) }]
        };
      }
      
      case 'delete_element': {
        const params = ElementIdSchema.parse(args);
        const { id } = params;
        
        if (!elements.has(id)) throw new Error(`Element with ID ${id} not found`);
        
        elements.delete(id);
        
        return {
          content: [{ type: 'text', text: JSON.stringify({ id, deleted: true }, null, 2) }]
        };
      }
      
      case 'query_elements': {
        const params = QuerySchema.parse(args || {});
        const { type, filter } = params;
        
        let results = Array.from(elements.values());
        
        if (type) {
          results = results.filter(element => element.type === type);
        }
        
        if (filter) {
          results = results.filter(element => {
            return Object.entries(filter).every(([key, value]) => {
              return element[key] === value;
            });
          });
        }
        
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
        };
      }
      
      case 'get_resource': {
        const params = ResourceSchema.parse(args);
        const { resource } = params;
        logger.info('Getting resource', { resource });
        
        let result;
        switch (resource) {
          case 'scene':
            result = {
              theme: sceneState.theme,
              viewport: sceneState.viewport,
              selectedElements: Array.from(sceneState.selectedElements)
            };
            break;
          case 'library':
            result = {
              elements: Array.from(elements.values())
            };
            break;
          case 'theme':
            result = {
              theme: sceneState.theme
            };
            break;
          case 'elements':
            result = {
              elements: Array.from(elements.values())
            };
            break;
          default:
            throw new Error(`Unknown resource: ${resource}`);
        }
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }
      
      case 'group_elements': {
        const params = ElementIdsSchema.parse(args);
        const { elementIds } = params;
        
        const groupId = generateId();
        sceneState.groups.set(groupId, elementIds);
        
        const result = { groupId, elementIds };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }
      
      case 'ungroup_elements': {
        const params = GroupIdSchema.parse(args);
        const { groupId } = params;
        
        if (!sceneState.groups.has(groupId)) {
          throw new Error(`Group ${groupId} not found`);
        }
        
        const elementIds = sceneState.groups.get(groupId);
        sceneState.groups.delete(groupId);
        
        const result = { groupId, ungrouped: true, elementIds };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }
      
      case 'align_elements': {
        const params = AlignElementsSchema.parse(args);
        const { elementIds, alignment } = params;
        
        // Implementation would align elements based on the specified alignment
        logger.info('Aligning elements', { elementIds, alignment });
        
        const result = { aligned: true, elementIds, alignment };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }
      
      case 'distribute_elements': {
        const params = DistributeElementsSchema.parse(args);
        const { elementIds, direction } = params;
        
        // Implementation would distribute elements based on the specified direction
        logger.info('Distributing elements', { elementIds, direction });
        
        const result = { distributed: true, elementIds, direction };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }
      
      case 'lock_elements': {
        const params = ElementIdsSchema.parse(args);
        const { elementIds } = params;
        
        elementIds.forEach(id => {
          const element = elements.get(id);
          if (element) {
            element.locked = true;
          }
        });
        
        const result = { locked: true, elementIds };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }
      
      case 'unlock_elements': {
        const params = ElementIdsSchema.parse(args);
        const { elementIds } = params;
        
        elementIds.forEach(id => {
          const element = elements.get(id);
          if (element) {
            element.locked = false;
          }
        });
        
        const result = { unlocked: true, elementIds };
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      // ADDED: Handler case for the new save_scene tool
      case 'save_scene': {
        const params = SaveSceneSchema.parse(args || {});
        const filename = params.filename || 'mcp_scene.excalidraw';

        if (!filename.endsWith('.excalidraw')) {
          throw new Error("Filename must end with .excalidraw");
        }

        // Convert selectedElements Set to the expected object format
        const selectedElementIds = {};
        sceneState.selectedElements.forEach(id => {
          selectedElementIds[id] = true;
        });

        // Ensure all elements have points in the correct format
        const elementsToSave = Array.from(elements.values()).map(el => {
          if ((el.type === 'arrow' || el.type === 'line') && (!el.points || el.points.length < 2)) {
            logger.warn(`Element ${el.id} of type ${el.type} has invalid/missing points. Adding default points.`);
            el.points = [[0, 0], [el.width || 10, el.height || 0]];
          }
          return el;
        });

        const sceneData = {
          type: "excalidraw",
          version: 2,
          source: "mcp-server",
          elements: elementsToSave,
          appState: {
            viewBackgroundColor: sceneState.viewBackgroundColor ?? "#ffffff",
            scrollX: sceneState.viewport?.x ?? 0,
            scrollY: sceneState.viewport?.y ?? 0,
            zoom: { value: sceneState.viewport?.zoom ?? 1 }, // Updated zoom format
            selectedElementIds: selectedElementIds, // Updated selectedElementIds format
            gridSize: null,
            zenModeEnabled: false,
            editingGroupId: null,
            theme: sceneState.theme ?? 'light',
            currentItemStrokeColor: "#000000",
            currentItemBackgroundColor: "transparent",
            currentItemFillStyle: "hachure",
            currentItemStrokeWidth: 1,
            currentItemStrokeStyle: "solid",
            currentItemRoughness: 1,
            currentItemOpacity: 100,
            currentItemFontFamily: 1,
            currentItemFontSize: 20,
            currentItemTextAlign: "center",
            currentItemStartArrowhead: null,
            currentItemEndArrowhead: "arrow",
          },
          files: {}
        };

        try {
          await fs.writeFile(filename, JSON.stringify(sceneData, null, 2), 'utf8');
          logger.info(`Scene saved successfully to ${filename}`);
          return {
            content: [{ type: 'text', text: `Scene saved successfully to ${filename}` }]
          };
        } catch (error) {
          logger.error(`Error saving scene: ${error.message}`, { error });
          return {
            content: [{ type: 'text', text: `Error saving scene: ${error.message}` }],
            isError: true
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`Error handling tool call: ${error.message}`, { error });
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Set up request handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info('Listing available tools');

  const tools = [
    {
      name: 'create_element',
      description: 'Create a new Excalidraw element',
      inputSchema: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) 
          },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          backgroundColor: { type: 'string' },
          strokeColor: { type: 'string' },
          strokeWidth: { type: 'number' },
          roughness: { type: 'number' },
          opacity: { type: 'number' },
          text: { type: 'string' },
          fontSize: { type: 'number' },
          fontFamily: { type: 'string' }
        },
        required: ['type', 'x', 'y']
      }
    },
    {
      name: 'update_element',
      description: 'Update an existing Excalidraw element',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { 
            type: 'string', 
            enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) 
          },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          backgroundColor: { type: 'string' },
          strokeColor: { type: 'string' },
          strokeWidth: { type: 'number' },
          roughness: { type: 'number' },
          opacity: { type: 'number' },
          text: { type: 'string' },
          fontSize: { type: 'number' },
          fontFamily: { type: 'string' }
        },
        required: ['id']
      }
    },
    {
      name: 'delete_element',
      description: 'Delete an Excalidraw element',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    },
    {
      name: 'query_elements',
      description: 'Query Excalidraw elements with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) 
          },
          filter: { 
            type: 'object',
            additionalProperties: true
          }
        }
      }
    },
    {
      name: 'get_resource',
      description: 'Get an Excalidraw resource',
      inputSchema: {
        type: 'object',
        properties: {
          resource: { 
            type: 'string', 
            enum: ['scene', 'library', 'theme', 'elements'] 
          }
        },
        required: ['resource']
      }
    },
    {
      name: 'group_elements',
      description: 'Group multiple elements together',
      inputSchema: {
        type: 'object',
        properties: {
          elementIds: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['elementIds']
      }
    },
    {
      name: 'ungroup_elements',
      description: 'Ungroup a group of elements',
      inputSchema: {
        type: 'object',
        properties: {
          groupId: { type: 'string' }
        },
        required: ['groupId']
      }
    },
    {
      name: 'align_elements',
      description: 'Align elements to a specific position',
      inputSchema: {
        type: 'object',
        properties: {
          elementIds: { 
            type: 'array',
            items: { type: 'string' }
          },
          alignment: { 
            type: 'string', 
            enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'] 
          }
        },
        required: ['elementIds', 'alignment']
      }
    },
    {
      name: 'distribute_elements',
      description: 'Distribute elements evenly',
      inputSchema: {
        type: 'object',
        properties: {
          elementIds: { 
            type: 'array',
            items: { type: 'string' }
          },
          direction: { 
            type: 'string', 
            enum: ['horizontal', 'vertical'] 
          }
        },
        required: ['elementIds', 'direction']
      }
    },
    {
      name: 'lock_elements',
      description: 'Lock elements to prevent modification',
      inputSchema: {
        type: 'object',
        properties: {
          elementIds: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['elementIds']
      }
    },
    {
      name: 'unlock_elements',
      description: 'Unlock elements to allow modification',
      inputSchema: {
        type: 'object',
        properties: {
          elementIds: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['elementIds']
      }
    },
    {
      name: 'save_scene',
      description: 'Saves the current Excalidraw elements and scene state to a .excalidraw file.',
      inputSchema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Optional filename ending with .excalidraw (default: mcp_scene.excalidraw)'
          }
        }
      }
    }
  ];
  
  return { tools };
});

// Start server with STDIO transport
async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Excalidraw MCP server running on stdio');
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

runServer();

if (process.env.DEBUG === 'true') {
  logger.debug('Debug mode enabled');
}

export default server;