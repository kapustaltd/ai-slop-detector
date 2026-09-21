package rubric

import (
	"path/filepath"
	"testing"
)

func TestRepositoryRubricsAreValid(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	for _, name := range []string{"backend.v1.yaml", "frontend.v1.yaml"} {
		value, err := Load(filepath.Join(root, "rubrics", name))
		if err != nil { t.Fatal(err) }
		if len(value.MetricIDs()) == 0 { t.Fatalf("%s has no metric ids", name) }
	}
}
