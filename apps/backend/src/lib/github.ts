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

export interface GitHubClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiBaseUrl?: string;
  loginBaseUrl?: string;
}

const OAUTH_SCOPES = ["read:user", "user:email"];

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
}
