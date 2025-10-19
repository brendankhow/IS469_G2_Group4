import requests
import json
import base64
import os
from typing import List, Dict, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

class GitHubDataFetcher:
    """
    Fetches repository data from GitHub API 
    """
    
    def __init__(self, access_token: str):
        """
        Initialize the fetcher with a GitHub personal access token.
        
        Args:
            access_token: GitHub personal access token for authentication
            tick repo and read:user 
        """
        self.access_token = access_token
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }
    
    def get_user_repos(self, username: str, max_repos: int = 100) -> List[Dict]:
        """
        Fetch all repositories for a given username.
        
        Args:
            username: GitHub username
            max_repos: Maximum number of repos to fetch
            
        Returns:
            List of repository dictionaries
        """
        repos = []
        page = 1
        per_page = 100
        
        while len(repos) < max_repos:
            url = f"{self.base_url}/users/{username}/repos"
            params = {
                "per_page": per_page,
                "page": page,
                "sort": "updated",
                "direction": "desc"
            }
            
            response = requests.get(url, headers=self.headers, params=params)
            
            if response.status_code != 200:
                print(f"Error fetching repos: {response.status_code}")
                break
            
            data = response.json()
            
            if not data:
                break
            
            repos.extend(data)
            page += 1
            
            if len(data) < per_page:
                break
        
        return repos[:max_repos]
    
    def get_repo_details(self, owner: str, repo_name: str) -> Dict:
        """
        Fetch detailed information about a specific repository.
        
        Args:
            owner: Repository owner username
            repo_name: Repository name
            
        Returns:
            Dictionary with repo details
        """
        url = f"{self.base_url}/repos/{owner}/{repo_name}"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            return response.json()
        return {}
    
    def get_readme(self, owner: str, repo_name: str) -> Optional[str]:
        """
        Fetch and decode README content from a repository.
        
        Args:
            owner: Repository owner username
            repo_name: Repository name
            
        Returns:
            README content as string, or None if not found
        """
        url = f"{self.base_url}/repos/{owner}/{repo_name}/readme"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            data = response.json()
            content = base64.b64decode(data['content']).decode('utf-8')
            return content
        return None
    
    def get_repo_languages(self, owner: str, repo_name: str) -> Dict[str, int]:
        """
        Fetch programming languages used in a repository.
        
        Args:
            owner: Repository owner username
            repo_name: Repository name
            
        Returns:
            Dictionary mapping language names to bytes of code
        """
        url = f"{self.base_url}/repos/{owner}/{repo_name}/languages"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            return response.json()
        return {}
    
    def get_repo_topics(self, owner: str, repo_name: str) -> List[str]:
        """
        Fetch repository topics/tags.
        
        Args:
            owner: Repository owner username
            repo_name: Repository name
            
        Returns:
            List of topic strings
        """
        url = f"{self.base_url}/repos/{owner}/{repo_name}/topics"
        headers = {**self.headers, "Accept": "application/vnd.github.mercy-preview+json"}
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            return response.json().get('names', [])
        return []
    
    def get_recent_commits(self, owner: str, repo_name: str, limit: int = 10) -> List[Dict]:
        """
        Fetch recent commits from a repository.
        
        Args:
            owner: Repository owner username
            repo_name: Repository name
            limit: Maximum number of commits to fetch
            
        Returns:
            List of commit dictionaries
        """
        url = f"{self.base_url}/repos/{owner}/{repo_name}/commits"
        params = {"per_page": limit}
        response = requests.get(url, headers=self.headers, params=params)
        
        if response.status_code == 200:
            return response.json()
        return []
    
    def get_repo_tree(self, owner: str, repo_name: str, branch: str = "main") -> List[Dict]:
        """
        Fetch repository file tree structure.
        
        Args:
            owner: Repository owner username
            repo_name: Repository name
            branch: Branch name (default: main)
            
        Returns:
            List of file/directory dictionaries
        """
        url = f"{self.base_url}/repos/{owner}/{repo_name}/git/trees/{branch}?recursive=1"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            return response.json().get('tree', [])
        
        # Try 'master' if 'main' doesn't exist
        if branch == "main":
            return self.get_repo_tree(owner, repo_name, "master")
        return []
    
    def get_file_content(self, owner: str, repo_name: str, file_path: str) -> Optional[str]:
        """
        Fetch content of a specific file from repository.
        
        Args:
            owner: Repository owner username
            repo_name: Repository name
            file_path: Path to file in repository
            
        Returns:
            File content as string, or None if not found
        """
        url = f"{self.base_url}/repos/{owner}/{repo_name}/contents/{file_path}"
        response = requests.get(url, headers=self.headers)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('encoding') == 'base64':
                try:
                    content = base64.b64decode(data['content']).decode('utf-8')
                    return content
                except:
                    return None
        return None
    
    def fetch_complete_repo_data(self, owner: str, repo_name: str) -> Dict:
        """
        Fetch comprehensive data for a repository suitable for vectorization.
        
        Args:
            owner: Repository owner username
            repo_name: Repository name
            
        Returns:
            Dictionary with all repo data
        """
        print(f"Fetching data for {owner}/{repo_name}...")
        
        repo_details = self.get_repo_details(owner, repo_name)
        readme = self.get_readme(owner, repo_name)
        languages = self.get_repo_languages(owner, repo_name)
        topics = self.get_repo_topics(owner, repo_name)
        commits = self.get_recent_commits(owner, repo_name, limit=5)
        tree = self.get_repo_tree(owner, repo_name)
        
        # Extract key information
        data = {
            "name": repo_details.get("name", ""),
            "full_name": repo_details.get("full_name", ""),
            "description": repo_details.get("description", ""),
            "url": repo_details.get("html_url", ""),
            "homepage": repo_details.get("homepage", ""),
            "created_at": repo_details.get("created_at", ""),
            "updated_at": repo_details.get("updated_at", ""),
            "pushed_at": repo_details.get("pushed_at", ""),
            "stars": repo_details.get("stargazers_count", 0),
            "forks": repo_details.get("forks_count", 0),
            "watchers": repo_details.get("watchers_count", 0),
            "open_issues": repo_details.get("open_issues_count", 0),
            "language": repo_details.get("language", ""),
            "languages": languages,
            "topics": topics,
            "readme": readme,
            "license": repo_details.get("license", {}).get("name", "") if repo_details.get("license") else "",
            "is_fork": repo_details.get("fork", False),
            "is_archived": repo_details.get("archived", False),
            "default_branch": repo_details.get("default_branch", "main"),
            "file_structure": [f["path"] for f in tree if f["type"] == "blob"],
            "recent_commits": [
                {
                    "message": c["commit"]["message"],
                    "date": c["commit"]["author"]["date"],
                    "author": c["commit"]["author"]["name"]
                } for c in commits
            ]
        }
        
        return data
    
    def fetch_all_user_repos_data(self, username: str, max_repos: int = 50, 
                                   include_forks: bool = True, 
                                   skip_inactive_forks: bool = True) -> List[Dict]:
        """
        Fetch complete data for all user repositories.
        
        Args:
            username: GitHub username
            max_repos: Maximum number of repos to process
            include_forks: Whether to include forked repositories
            skip_inactive_forks: If True, skip forks with no commits by the user
            
        Returns:
            List of complete repo data dictionaries
        """
        repos = self.get_user_repos(username, max_repos)
        all_data = []
        
        for repo in repos:
            # Handle fork filtering
            if repo.get("fork"):
                if not include_forks:
                    print(f"Skipping fork: {repo['name']}")
                    continue
                
                if skip_inactive_forks:
                    # Check if user has made commits to this fork
                    commits = self.get_recent_commits(repo["owner"]["login"], repo["name"], limit=5)
                    user_has_commits = any(
                        c.get("commit", {}).get("author", {}).get("name", "").lower() == username.lower() or
                        c.get("author", {}).get("login", "").lower() == username.lower()
                        for c in commits
                    )
                    
                    if not user_has_commits:
                        print(f"Skipping inactive fork: {repo['name']}")
                        continue
            
            try:
                data = self.fetch_complete_repo_data(repo["owner"]["login"], repo["name"])
                all_data.append(data)
            except Exception as e:
                print(f"Error fetching {repo['name']}: {str(e)}")
                continue
        
        return all_data
    
    def save_to_json(self, data: List[Dict], filename: str = "github_data.json"):
        """
        Save fetched data to JSON file.
        
        Args:
            data: Data to save
            filename: Output filename
        """
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Data saved to {filename}")


def fetch_all_user_repos_data(
    username: str,
    access_token: Optional[str] = None,
    max_repos: int = 50,
    include_forks: bool = True,
    skip_inactive_forks: bool = False
) -> List[Dict]:
    """
    Fetch complete data for all user repositories.
    
    Args:
        username: GitHub username
        access_token: GitHub personal access token (if None, will use GITHUB_ACCESS_TOKEN env var)
        max_repos: Maximum number of repos to process
        include_forks: Whether to include forked repositories
        skip_inactive_forks: If True, skip forks with no commits by the user
        
    Returns:
        List of complete repo data dictionaries
    """
    # Get access token from parameter or environment - if we do a connect to github thing
    token = access_token or os.getenv("GITHUB_ACCESS_TOKEN")
    
    if not token:
        raise ValueError(
            "GitHub access token is required. Either pass it as 'access_token' parameter "
            "or set the GITHUB_ACCESS_TOKEN environment variable."
        )
    
    # Initialize the fetcher and fetch data
    fetcher = GitHubDataFetcher(token)
    return fetcher.fetch_all_user_repos_data(
        username=username,
        max_repos=max_repos,
        include_forks=include_forks,
        skip_inactive_forks=skip_inactive_forks
    )