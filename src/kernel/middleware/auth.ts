/**
 * SHALE YEAH Agent OS - Auth Middleware
 *
 * Permission gate for tool access control.
 * Implements Arcade patterns:
 * - Permission Gate (role-based access control)
 * - Secret Injection (env-var driven enable/disable)
 */

import type { AuthResult, Permission, UserIdentity } from "../types.js";

// ==========================================
// Role → Permission mapping
// ==========================================

/**
 * Default permissions for each role.
 * Roles are hierarchical: admin > executive > engineer > analyst.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
	analyst: ["read:analysis"],
	engineer: ["read:analysis", "write:reports"],
	executive: ["read:analysis", "write:reports", "execute:decisions"],
	admin: ["read:analysis", "write:reports", "execute:decisions", "admin:servers", "admin:users"],
};

// ==========================================
// Tool → Permission mapping
// ==========================================

/**
 * Maps tool name patterns to required permissions.
 * More specific patterns checked first.
 */
const TOOL_PERMISSIONS: Array<{ pattern: RegExp; permission: Permission }> = [
	// Command tools requiring elevated permissions
	{ pattern: /^decision\./, permission: "execute:decisions" },
	{ pattern: /^reporter\./, permission: "write:reports" },
	// Admin tools
	{ pattern: /^admin\./, permission: "admin:servers" },
	// All other tools default to read:analysis (query tools)
];

/** Default permission required for tools not matching any specific pattern */
const DEFAULT_PERMISSION: Permission = "read:analysis";

// ==========================================
// AuthMiddleware
// ==========================================

/**
 * Permission gate middleware for tool access control.
 * When auth is disabled (default), all requests are allowed.
 */
export class AuthMiddleware {
	private enabled: boolean;

	constructor(enabled?: boolean) {
		this.enabled = enabled ?? process.env.KERNEL_AUTH_ENABLED === "true";
	}

	/**
	 * Check whether a user identity is authorized to call a tool.
	 */
	check(toolName: string, identity: UserIdentity): AuthResult {
		// When auth is disabled, allow everything
		if (!this.enabled) {
			return { allowed: true };
		}

		const requiredPermission = this.getRequiredPermission(toolName);
		const userPermissions = this.getEffectivePermissions(identity);

		if (userPermissions.includes(requiredPermission)) {
			return { allowed: true };
		}

		// Find the minimum role that has this permission
		const requiredRole = this.getMinimumRole(requiredPermission);

		return {
			allowed: false,
			reason: `Permission '${requiredPermission}' required for tool '${toolName}'. Role '${identity.role}' does not have this permission.`,
			requiredRole,
			requiredPermissions: [requiredPermission],
		};
	}

	/**
	 * Get the required permission for a tool name.
	 */
	getRequiredPermission(toolName: string): Permission {
		for (const { pattern, permission } of TOOL_PERMISSIONS) {
			if (pattern.test(toolName)) return permission;
		}
		return DEFAULT_PERMISSION;
	}

	/**
	 * Get effective permissions for an identity.
	 * Combines role-based defaults with any explicit permissions.
	 */
	getEffectivePermissions(identity: UserIdentity): Permission[] {
		const rolePerms = ROLE_PERMISSIONS[identity.role] ?? [];
		// Merge role permissions with any explicitly granted permissions
		const all = new Set([...rolePerms, ...identity.permissions]);
		return Array.from(all);
	}

	/**
	 * Whether auth checking is currently enabled.
	 */
	get isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Find the minimum role that has a given permission.
	 */
	private getMinimumRole(permission: Permission): string {
		const roleHierarchy = ["analyst", "engineer", "executive", "admin"];
		for (const role of roleHierarchy) {
			if (ROLE_PERMISSIONS[role]?.includes(permission)) return role;
		}
		return "admin";
	}
}
