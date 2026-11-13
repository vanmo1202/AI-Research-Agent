-- Optional WF05 scheduling. Existing research tables/001-003 are unchanged.
CREATE TABLE research_schedules (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id TEXT NOT NULL REFERENCES users(id),
 request_id TEXT NOT NULL REFERENCES requests(id),
 enabled BOOLEAN NOT NULL DEFAULT false,
 options_json JSONB NOT NULL,
 max_concurrent INTEGER NOT NULL DEFAULT 1 CHECK(max_concurrent BETWEEN 1 AND 3),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX research_schedules_owner ON research_schedules(owner_id,created_at);
CREATE INDEX research_schedules_request ON research_schedules(request_id);
CREATE TABLE research_schedule_dispatches (
 schedule_id UUID NOT NULL REFERENCES research_schedules(id),
 window_key TEXT NOT NULL,
 dispatch_day DATE NOT NULL,
 run_id TEXT NOT NULL UNIQUE REFERENCES research_runs(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(schedule_id,window_key)
);
CREATE INDEX schedule_dispatches_day ON research_schedule_dispatches(dispatch_day,schedule_id);
