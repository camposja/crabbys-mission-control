module Api
  module V1
    # Handles the planning workflow for a task:
    #   POST /tasks/:id/plan          — generate clarifying questions + draft plan via OpenClaw
    #   POST /tasks/:id/plan/approve  — user approves plan, spawns sub-agent, moves task to in_progress
    class TaskPlansController < BaseController
      before_action :set_task

      # POST /api/v1/tasks/:id/plan
      # Step 1: send task to OpenClaw for clarifying questions + initial plan.
      # Falls back to a template plan if OpenClaw is unreachable.
      def create
        answers = params[:answers]  # nil on first call, populated on second call

        plan_result = if answers.present?
          synthesise_plan(answers)
        else
          generate_questions
        end

        @task.update!(
          plan_questions: plan_result[:questions],
          plan_content:   plan_result[:plan]
        )

        render json: {
          task_id:   @task.id,
          questions: plan_result[:questions],
          plan:      plan_result[:plan],
          ready:     plan_result[:plan].present?
        }
      end

      # POST /api/v1/tasks/:id/plan/approve
      # Step 2: user reviewed plan. Optionally spawn an agent.
      # Default: just approve the plan and move to in_progress (no spawn).
      # Pass spawn: true to also enqueue SpawnAgentJob.
      def approve
        edited_plan = params[:plan]
        spawn_agent = ActiveModel::Type::Boolean.new.cast(params[:spawn])

        @task.update!(
          plan_content:    edited_plan || @task.plan_content,
          plan_approved_at: Time.current
        )

        # Move task to in_progress via AASM if still in backlog
        @task.start! if @task.backlog?

        if spawn_agent
          SpawnAgentJob.perform_later(@task.id)
          ::EventStore.emit(
            type:    "plan_approved",
            message: "Plan approved for \"#{@task.title}\" — spawning agent",
            metadata: { task_id: @task.id, project_id: @task.project_id }
          )
          render json: { task: @task, message: "Plan approved. Agent is being spawned." }
        else
          ::EventStore.emit(
            type:    "plan_approved",
            message: "Plan approved for \"#{@task.title}\" — assigned to Crabby (no spawn)",
            metadata: { task_id: @task.id, project_id: @task.project_id }
          )
          render json: { task: @task, message: "Plan approved. Task assigned to Crabby." }
        end
      end

      private

      def set_task
        @task = Task.find(params[:id] || params[:task_id])
      end

      def generate_questions
        prompt = <<~PROMPT
          You are a planning assistant. A user wants to work on the following task:

          Title: #{@task.title}
          Description: #{@task.description.presence || "(none)"}
          Priority: #{@task.priority}
          Assignee: #{@task.assignee}

          Generate 3-5 short clarifying questions that would help you create a better execution plan.
          Respond with JSON: { "questions": ["question 1", "question 2", ...] }
        PROMPT

        begin
          response = gateway.chat_send(
            content:    prompt,
            agent_id:   "main",
            session_id: "planning-#{@task.id}"
          )
          raw = response.dig("message", "content") || response["content"] || ""
          parsed = JSON.parse(raw.match(/\{.*\}/m)&.[](0) || "{}")
          { questions: parsed["questions"] || default_questions, plan: nil }
        rescue
          { questions: default_questions, plan: nil }
        end
      end

      def synthesise_plan(answers)
        answers_text = answers.map.with_index { |a, i| "Q#{i+1}: #{a}" }.join("\n")
        prompt = <<~PROMPT
          Create a step-by-step execution plan for this task:

          Title: #{@task.title}
          Description: #{@task.description.presence || "(none)"}

          Answers to clarifying questions:
          #{answers_text}

          Respond with a numbered plan. Be specific about sub-tasks and which role handles each step
          (e.g. researcher, writer, reviewer). Keep it concise (5-8 steps max).
        PROMPT

        begin
          response = gateway.chat_send(
            content:    prompt,
            agent_id:   "main",
            session_id: "planning-#{@task.id}"
          )
          plan_text = response.dig("message", "content") || response["content"] || fallback_plan
          { questions: @task.plan_questions, plan: plan_text }
        rescue
          { questions: @task.plan_questions, plan: fallback_plan }
        end
      end

      def default_questions
        [
          "What is the desired outcome or definition of done?",
          "Are there any dependencies or blockers?",
          "What is the deadline or time constraint?",
          "Should any specific tools or resources be used?"
        ]
      end

      def fallback_plan
        <<~PLAN
          1. [Researcher] Gather context and relevant information for "#{@task.title}"
          2. [Planner] Break down into sub-tasks and identify dependencies
          3. [Executor] Carry out the main work
          4. [Reviewer] Check output against the definition of done
          5. [Closer] Summarise results and update task status to Done
        PLAN
      end
    end
  end
end
