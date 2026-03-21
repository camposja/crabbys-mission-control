Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Health
      get "health", to: "health#index"

      # OpenClaw gateway proxy
      namespace :openclaw do
        get  "agents",     to: "agents#index"
        get  "agents/:id", to: "agents#show"
        get  "sessions",   to: "sessions#index"
        post "message",    to: "messages#create"
      end

      # Tasks / Kanban
      resources :tasks do
        member { patch :move }
      end

      # Projects
      resources :projects do
        resources :tasks, only: [:index]
      end

      # Calendar / cron
      resources :calendar_events
      resources :cron_jobs

      # Memory
      resources :memories, only: [:index, :show, :update, :destroy]
      get "memories/search", to: "memories#search"

      # Usage / cost tracking
      get "usage", to: "usage#index"

      # Mission statement
      resource :mission_statement, only: [:show, :update]

      # Settings
      resource :settings, only: [:show, :update]

      # Dashboard stats snapshot
      get "stats",   to: "stats#index"

      # Full board snapshot — pollable by OpenClaw heartbeat
      get "board",   to: "board#index"

      # Gateway health
      get "gateway", to: "gateway#show"

      # Upcoming calendar events (dashboard widget)
      get "calendar/upcoming", to: "calendar_upcoming#index"

      # Live event feed replay
      get "events/recent", to: "events#recent"
    end
  end

  # Action Cable
  mount ActionCable.server => "/cable"
end
