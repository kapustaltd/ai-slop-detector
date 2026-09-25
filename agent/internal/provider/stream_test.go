package provider

import (
	"io"
	"strings"
	"testing"
	"time"
)

func TestStreamPublishesBeforeResultAndOmitsPrivateContent(t *testing.T) {
	reader, writer := io.Pipe()
	defer reader.Close()
	events := make(chan Activity, 4)
	done := make(chan error, 1)
	go func() {
		raw, err := readStream(reader, Request{RepoPath: "/repo", Categories: map[string]string{"M1": "Ошибки"}, OnActivity: func(a Activity) { events <- a }})
		if err == nil && !strings.Contains(string(raw), `"result":"{}"`) {
			t.Error("missing final report")
		}
		done <- err
	}()
	_, _ = io.WriteString(writer, `{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"private"},{"type":"tool_use","id":"t1","name":"Read","input":{"file_path":"/repo/src/main.go"}},{"type":"text","text":"PROGRESS {\"category\":\"M1\",\"summary\":\"Проверяю обработку ошибок\"}"}]}}`+"\n")
	select {
	case event := <-events:
		if event.Kind != "tool" || event.Detail != "src/main.go" || event.State != "running" {
			t.Fatalf("bad event: %+v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("activity buffered until completion")
	}
	if event := <-events; event.Kind != "reasoning" || event.CategoryID != "M1" {
		t.Fatalf("bad summary: %+v", event)
	}
	_, _ = io.WriteString(writer, `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"t1","content":"SECRET FILE CONTENT","is_error":true}]}}`+"\n")
	if event := <-events; event.State != "failed" || strings.Contains(event.Detail, "SECRET") {
		t.Fatalf("unsafe result: %+v", event)
	}
	_, _ = io.WriteString(writer, `{"type":"result","result":"{}"}`+"\n")
	writer.Close()
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if len(events) != 0 {
		t.Fatal("unexpected private events")
	}
}

func TestStreamRequiresSuccessfulResult(t *testing.T) {
	for _, input := range []string{"", `{"type":"system"}`, `{"type":"result","is_error":true}`, `broken`} {
		if _, err := readStream(strings.NewReader(input), Request{}); err == nil {
			t.Errorf("accepted incomplete/error stream: %s", input)
		}
	}
}
