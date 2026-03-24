Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Health
      get "health", to: "health#index"

      # OpenClaw gateway proxy + inbound webhook
      namespace :openclaw do
        get  "agents",     to: "agents#index"
        get  "agents/:id", to: "agents#show"
        get  "sessions",   to: "sessions#index"
        post "message",    to: "messages#create"
        post "webhook",    to: "webhook#create"
      end

      # End-to-end integration validation (runs live probes against the gateway)
      get "integration_check", to: "integration_check#index"

      # Tasks / Kanban
      resources :tasks do
        member do
          patch :move
          post  :plan,         to: "task_plans#create"
          post  :plan_approve, to: "task_plans#approve"
        end
      end

      # Projects
      resources :projects do
        member do
          get :summary
          get :activity
        end
        resources :tasks, only: [:index]
      end

      # Calendar / cron
      resources :calendar_events
      resources :cron_jobs do
        member do
          patch :toggle
          post  :run_now
        end
      end

      # Job applications
      resources :job_applications, only: [:index, :create, :update] do
        collection do
          get :grouped_by_date
          post :sync
        end
      end

      # Agents (direct, merged with gateway)
      resources :agents, only: [:index, :show] do
        member do
          post :pause
          post :resume
          delete :terminate
        end
      end

      # Models
      resources :models, only: [:index] do
        collection do
          get :live
        end
      end

      # Workspace documents (with upload + search)
      resources :documents, only: [:index] do
        collection do
          get  :content
          patch :content,  action: :update_content
          get  :search
          post :upload
        end
      end

      # Memory
      resources :memories, only: [:index, :show, :update, :destroy] do
        collection do
          get   :search
          get   :journal
          patch :journal, action: :update_journal
        end
      end

      # Usage / cost tracking
      scope "usage" do
        get  "/",           to: "usage#index",             as: :usage
        get  "timeline",    to: "usage#timeline",          as: :usage_timeline
        get  "thresholds",  to: "usage#thresholds",        as: :usage_thresholds
        patch "thresholds", to: "usage#update_thresholds", as: :update_usage_thresholds
        post "ingest",      to: "usage#ingest",            as: :usage_ingest
      end

      # Diagnostics / health
      scope "diagnostics" do
        get  "/",               to: "diagnostics#index",           as: :diagnostics
        post "restart_gateway", to: "diagnostics#restart_gateway", as: :restart_gateway
      end

      # Mission statement
      resource :mission_statement, only: [:show, :update] do
        post :suggest, on: :member
      end

      # Settings
      resource :settings, only: [:show, :update]

      # Dashboard stats snapshot
      get "stats",   to: "stats#index"

      # Full board snapshot — pollable by OpenClaw heartbeat
      get "board",   to: "board#index"

      # Terminal sessions metadata (actual I/O is via TerminalChannel)
      scope "terminal" do
        get  "sessions",        to: "terminal#sessions"
        delete "sessions/:session_id", to: "terminal#destroy", as: :terminal_session
      end

      # Security audit + remote access
      scope "security" do
        get "audit",         to: "security#audit"
        get "remote_access", to: "security#remote_access"
        get "permissions",   to: "security#permissions"
      end

      # Feedback / feature requests
      resources :feedbacks, only: [:index, :show, :create] do
        member do
          patch :update_status
        end
      end

      # Ops notes / command cheatsheet
      resources :ops_notes

      # Gateway health
      get "gateway", to: "gateway#show"

      # Calendar dashboard (combined view)
      scope "calendar" do
        get  "/",                  to: "calendar#index",     as: :calendar
        get  "events",             to: "calendar#events",    as: :calendar_events_range
        get  "events/:id/history", to: "calendar#history",   as: :calendar_event_history
        get  "cron_jobs",          to: "calendar#cron_jobs",  as: :calendar_cron_jobs
        get  "summary",            to: "calendar#summary",   as: :calendar_summary
        get  "today",              to: "calendar#today",     as: :calendar_today
        get  "week",               to: "calendar#week",      as: :calendar_week
      end

      # Upcoming calendar events (dashboard widget)
      get "calendar/upcoming", to: "calendar_upcoming#index"

      # Live event feed replay
      get "events/recent", to: "events#recent"
    end
  end

  # Action Cable
  mount ActionCable.server => "/cable"
end
