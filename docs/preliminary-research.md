# User Prompt

i've been given a project whose requirements, both functional and technical, are listed in @requirements.md 

i've started creating basic tables in the supabase panel, but no metadata-related yet. also i'm starting the project over since this file suggest micro frontend architecture. i'm going to need a little bit of explanation on how to combine multiple react microfrontends with edge functions and supabase together on amplify

# Assistant Response

**Below is a conceptual overview of how to integrate React-based microfrontends with Supabase, Edge Functions, and AWS Amplify, as well as a suggestion of best practices rules you could include in a Cursor configuration file.**

---

## 1. Combining Multiple React Microfrontends, Edge Functions, and Supabase on Amplify

### 1.1 Monorepo vs. Multi-Repo
- **Monorepo (Recommended):**  
  A single repository containing each microfrontend in its own folder alongside a shared folder for edge functions. This setup allows you to have a single source of truth for business and routing logic. 
  - Example structure:
    ```
    /auto-crm/
      /packages/
        /microfrontend-web/
        /microfrontend-admin/
        /edge-functions/
      /shared/
      README.md
      ...
    ```
  - Each microfrontend and the edge-functions folder can be deployed independently within Amplify, but still benefit from a shared codebase and shared dependencies.

- **Multi-Repo:**  
  If you prefer each microfrontend to live in its own repository, you can do this, but it increases overhead in synchronizing logic changes and dependencies across multiple repos. A dedicated “central edge functions” repo might become your single source of truth for server-side functionality.

### 1.2 Setting Up Supabase
- **Database + Auth**: Supabase provides Postgres, authentication, and storage. Each microfrontend uses the same Supabase project credentials to read/write ticket data, manage user sessions, etc.  
- **Edge Functions (Supabase)**:  
  - You can write custom server-side logic in Supabase edge functions (TypeScript/JavaScript), which you then call from your microfrontends.  
  - Alternatively, if you want all business logic in a single place, you could host these functions (or additional microservices) within the same codebase you push to Amplify.  

### 1.3 Deploying on AWS Amplify
1. **Create an Amplify App** in the AWS console for your project.  
2. **Connect Your Repository/Monorepo**: Point Amplify to your repo containing the microfrontends and edge functions.  
3. **Configure Build Settings**:  
   - For each microfrontend folder, define the build command (e.g., yarn install && yarn build) and the build output directory (e.g., /build for React).  
   - If you’re using a monorepo tool like Turborepo or Nx, your Amplify build scripts will likely revolve around those commands.  
4. **Multiple Frontends**:  
   - You can configure Amplify “branches” (or “environments”) to each folder in your monorepo.  
   - Each branch can correspond to a separate microfrontend. This allows you to attach a unique subdomain or path to each build.  
   - Example:
     - microfrontend-web → https://main.myapp.com/
     - microfrontend-admin → https://admin.myapp.com/  
5. **Edge Functions**:  
   - If also deploying Supabase edge functions, you can either run them directly in Supabase or as serverless functions/lambdas behind Amplify.  
   - If you prefer centralizing all server functions in Supabase, your microfrontends on Amplify will simply call those endpoints via fetch/Axios.

### 1.4 Recommended Workflow
1. **Local Development**:  
   - Spin up local dev servers for each microfrontend (e.g., on different ports).  
   - Use environment variables to point each front-end to your local Supabase instance (or dev environment) and/or local edge functions.  
2. **Commit**:  
   - Push changes to the monorepo.  
   - Amplify triggers a pipeline that builds each microfrontend and optionally triggers tests.  
3. **Deployment**:  
   - Amplify automatically deploys each microfrontend, attaching it to a subdomain or path you’ve designated.
