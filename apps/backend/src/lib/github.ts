import jwt from "jsonwebtoken";

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export interface GitHubAccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string | null;
  private: boolean;
  permissions?: { admin?: boolean; push?: boolean; pull?: boolean };
}

/** Shape of `GET /repositories/{id}` — the fields assignment needs on top. */
export interface GitHubRepoDetail extends GitHubRepo {
  default_branch?: string | null;
}

export interface GitHubClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiBaseUrl?: string;
  loginBaseUrl?: string;
}

export interface GitHubAppClientOptions {
  appId: string;
  appSlug: string;
  privateKey: string;
  apiBaseUrl?: string;
  loginBaseUrl?: string;
}

export interface GitHubInstallationToken {
  token: string;
  expiresAt: string;
  permissions: Record<string, string>;
}

export interface GitHubAppRepositoryList {
  totalCount: number;
  repositories: GitHubRepo[];
}

/**
 * GitHub App client. Authenticates as the app (RS256 JWT signed with the app
 * private key) to mint installation access tokens, which in turn grant
 * repository-scoped access for listing installed repos.
 */
export class GitHubAppClient {
  private readonly apiBaseUrl: string;
  private readonly loginBaseUrl: string;
  private readonly normalizedKey: string;

  constructor(private readonly options: GitHubAppClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.github.com";
    this.loginBaseUrl = options.loginBaseUrl ?? "https://github.com";
    this.normalizedKey = options.privateKey.replace(/\\n/g, "\n").trim();
  }

  buildInstallUrl(state: string): string {
    const params = new URLSearchParams({ state });
    return `${this.loginBaseUrl}/apps/${this.options.appSlug}/installations/new?${params.toString()}`;
  }

  private createAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iat: now - 60, exp: now + 540, iss: this.options.appId },
      this.normalizedKey,
      { algorithm: "RS256" },
    );
  }

  async getInstallationToken(
    installationId: string,
    permissions?: Record<string, string>,
  ): Promise<GitHubInstallationToken> {
    const response = await fetch(
      `${this.apiBaseUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.createAppJwt()}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(permissions ? { permissions } : {}),
      },
    );
    if (!response.ok) {
      throw new Error(`GitHub installation token failed: ${response.status}`);
    }
    return (await response.json()) as GitHubInstallationToken;
  }

  async listInstallationRepos(installationId: string): Promise<GitHubRepo[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/app/installations/${installationId}/repositories?per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.createAppJwt()}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `GitHub list installation repos failed: ${response.status}`,
      );
    }
    const data = (await response.json()) as GitHubAppRepositoryList;
    return data.repositories ?? [];
  }
}

export const OAUTH_SCOPES = ["read:user", "user:email", "repo"];

/** Minimal GitHub OAuth App client. Base URLs are overridable for tests. */
export class GitHubClient {
  private readonly apiBaseUrl: string;
  private readonly loginBaseUrl: string;

  constructor(private readonly options: GitHubClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.github.com";
    this.loginBaseUrl = options.loginBaseUrl ?? "https://github.com";
  }

  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUri,
      scope: OAUTH_SCOPES.join(" "),
      state,
    });
    return `${this.loginBaseUrl}/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<GitHubAccessTokenResponse> {
    const response = await fetch(
      `${this.loginBaseUrl}/login/oauth/access_token`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams({
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          code,
          redirect_uri: this.options.redirectUri,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.status}`);
    }
    const data = (await response.json()) as GitHubAccessTokenResponse;
    if (!data.access_token) {
      throw new Error("GitHub token exchange returned no access token");
    }
    return data;
  }

  async getUser(accessToken: string): Promise<GitHubUser> {
    return this.get<GitHubUser>("/user", accessToken);
  }

  async getUserEmails(accessToken: string): Promise<GitHubEmail[]> {
    return this.get<GitHubEmail[]>("/user/emails", accessToken);
  }

  /** Fetch a single repo by its GitHub id, including permission info. */
  async getRepo(accessToken: string, id: number): Promise<GitHubRepoDetail> {
    return this.get<GitHubRepoDetail>(`/repositories/${id}`, accessToken);
  }

  /**
   * List repositories the user has admin access to. Paginates through up to
   * `maxPages` pages of 100 repos each. Only repos with `permissions.admin`
   * are returned (needed to create webhooks).
   */
  async listAdminRepos(
    accessToken: string,
    maxPages = 5,
  ): Promise<GitHubRepo[]> {
    const all: GitHubRepo[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.get<GitHubRepo[]>(
        `/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
        accessToken,
      );
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all.filter((r) => r.permissions?.admin === true);
  }

  /**
   * Create a webhook on the given repository. Returns the created hook id.
   */
  async createRepoHook(
    accessToken: string,
    fullName: string,
    url: string,
    secret: string,
  ): Promise<{ id: number }> {
    return this.postJson<{ id: number }>(
      `/repos/${fullName}/hooks`,
      accessToken,
      {
        config: { url, secret, content_type: "json" },
        events: ["push", "pull_request", "issues", "issue_comment"],
        active: true,
      },
    );
  }

  private async get<T>(path: string, accessToken: string): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${path} failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async postJson<T>(
    path: string,
    accessToken: string,
    body: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `GitHub API ${path} failed: ${response.status} ${text}`.trim(),
      );
    }
    return (await response.json()) as T;
  }
}
