package registry

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

var (
	ErrTeamExists   = errors.New("team already exists")
	ErrTeamNotFound = errors.New("team not found")
)

func Add(path string, team Team) error {
	doc, _, teams, value, err := readDocument(path)
	if err != nil {
		return err
	}
	for _, current := range value.Teams {
		if current.ID == team.ID {
			return ErrTeamExists
		}
	}
	value.Teams = append(value.Teams, team)
	if err := value.Validate(); err != nil {
		return err
	}
	encoded, err := yaml.Marshal(team)
	if err != nil {
		return fmt.Errorf("encode team: %w", err)
	}
	var teamDoc yaml.Node
	if err := yaml.Unmarshal(encoded, &teamDoc); err != nil {
		return fmt.Errorf("decode new team: %w", err)
	}
	teams.Content = append(teams.Content, teamDoc.Content[0])
	return writeDocument(path, doc)
}

// Update edits supported fields while keeping the team's ID and paths when omitted.
func Update(path, id string, replacement Team) error {
	doc, root, _, value, err := readDocument(path)
	if err != nil {
		return err
	}
	index := -1
	for i := range value.Teams {
		if value.Teams[i].ID == id {
			index = i
			if replacement.Paths == nil {
				replacement.Paths = value.Teams[i].Paths
			}
			value.Teams[i] = replacement
			value.Teams[i].ID = id
			break
		}
	}
	if index < 0 {
		return ErrTeamNotFound
	}
	if err := value.Validate(); err != nil {
		return err
	}
	teamsNode := mappingValue(root, "teams")
	for _, teamNode := range teamsNode.Content {
		if scalarValue(mappingValue(teamNode, "id")) != id {
			continue
		}
		team := value.Teams[index]
		setScalar(teamNode, "name", team.Name, "!!str")
		setScalar(teamNode, "repo", team.Repo, "!!str")
		setScalar(teamNode, "branch", team.Branch, "!!str")
		active := mappingValue(teamNode, "active")
		if active == nil {
			setScalar(teamNode, "active", fmt.Sprint(team.Active), "!!bool")
		} else {
			active.Value = fmt.Sprint(team.Active)
			active.Tag = "!!bool"
		}
		if replacement.Paths != nil {
			setPaths(teamNode, team.Paths)
		}
		break
	}
	return writeDocument(path, doc)
}

func Remove(path, id string) error {
	doc, _, teamsNode, value, err := readDocument(path)
	if err != nil {
		return err
	}
	index := -1
	for i := range value.Teams {
		if value.Teams[i].ID == id {
			index = i
			break
		}
	}
	if index < 0 {
		return ErrTeamNotFound
	}
	value.Teams = append(value.Teams[:index], value.Teams[index+1:]...)
	if err := value.Validate(); err != nil {
		return err
	}
	for i, teamNode := range teamsNode.Content {
		if scalarValue(mappingValue(teamNode, "id")) == id {
			teamsNode.Content = append(teamsNode.Content[:i], teamsNode.Content[i+1:]...)
			break
		}
	}
	return writeDocument(path, doc)
}

func readDocument(path string) (*yaml.Node, *yaml.Node, *yaml.Node, Registry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, nil, Registry{}, fmt.Errorf("read registry %s: %w", path, err)
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, nil, nil, Registry{}, fmt.Errorf("decode registry %s: %w", path, err)
	}
	if len(doc.Content) == 0 {
		return nil, nil, nil, Registry{}, fmt.Errorf("decode registry %s: document is empty", path)
	}
	root := doc.Content[0]
	var value Registry
	if err := root.Decode(&value); err != nil {
		return nil, nil, nil, Registry{}, fmt.Errorf("decode registry %s: %w", path, err)
	}
	if err := value.Validate(); err != nil {
		return nil, nil, nil, Registry{}, fmt.Errorf("validate registry %s: %w", path, err)
	}
	teams := mappingValue(root, "teams")
	if teams == nil || teams.Kind != yaml.SequenceNode {
		return nil, nil, nil, Registry{}, fmt.Errorf("validate registry %s: teams must be a sequence", path)
	}
	return &doc, root, teams, value, nil
}

func writeDocument(path string, doc *yaml.Node) error {
	var output bytes.Buffer
	encoder := yaml.NewEncoder(&output)
	encoder.SetIndent(2)
	if err := encoder.Encode(doc); err != nil {
		return fmt.Errorf("encode registry: %w", err)
	}
	if err := encoder.Close(); err != nil {
		return fmt.Errorf("close encoded registry: %w", err)
	}
	data := output.Bytes()
	mode := os.FileMode(0o600)
	if info, err := os.Stat(path); err == nil {
		mode = info.Mode().Perm()
	}
	directory := filepath.Dir(path)
	temp, err := os.CreateTemp(directory, ".registry-*.yaml")
	if err != nil {
		return fmt.Errorf("create registry temp file: %w", err)
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if err := temp.Chmod(mode); err != nil {
		_ = temp.Close()
		return fmt.Errorf("set registry permissions: %w", err)
	}
	if _, err := temp.Write(data); err != nil {
		_ = temp.Close()
		return fmt.Errorf("write registry: %w", err)
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return fmt.Errorf("sync registry: %w", err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close registry: %w", err)
	}
	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("replace registry: %w", err)
	}
	return nil
}

func mappingValue(mapping *yaml.Node, key string) *yaml.Node {
	if mapping == nil || mapping.Kind != yaml.MappingNode {
		return nil
	}
	for i := 0; i+1 < len(mapping.Content); i += 2 {
		if mapping.Content[i].Value == key {
			return mapping.Content[i+1]
		}
	}
	return nil
}

func scalarValue(node *yaml.Node) string {
	if node == nil {
		return ""
	}
	return node.Value
}

func setScalar(mapping *yaml.Node, key, value, tag string) {
	if node := mappingValue(mapping, key); node != nil {
		node.Value = value
		node.Tag = tag
		return
	}
	mapping.Content = append(mapping.Content,
		&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: key},
		&yaml.Node{Kind: yaml.ScalarNode, Tag: tag, Value: value, Style: yaml.DoubleQuotedStyle},
	)
}

func setPaths(teamNode *yaml.Node, paths map[string]string) {
	old := mappingValue(teamNode, "paths")
	if len(paths) == 0 {
		if old == nil {
			return
		}
		for i := 0; i+1 < len(teamNode.Content); i += 2 {
			if teamNode.Content[i].Value == "paths" {
				teamNode.Content = append(teamNode.Content[:i], teamNode.Content[i+2:]...)
				return
			}
		}
		return
	}
	node := &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
	if old != nil {
		node.HeadComment = old.HeadComment
		node.LineComment = old.LineComment
		node.FootComment = old.FootComment
	}
	for _, area := range []string{"backend", "frontend"} {
		if path, ok := paths[area]; ok {
			node.Content = append(node.Content,
				&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: area},
				&yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: path, Style: yaml.DoubleQuotedStyle},
			)
		}
	}
	if old == nil {
		teamNode.Content = append(teamNode.Content, &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: "paths"}, node)
		return
	}
	for i := 0; i+1 < len(teamNode.Content); i += 2 {
		if teamNode.Content[i].Value == "paths" {
			teamNode.Content[i+1] = node
			return
		}
	}
}
