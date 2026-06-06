#!/usr/bin/env python3
import json, os, sys
from pathlib import Path

if __name__ == "__main__":
    def main():
        from graphify.detect import detect
        from graphify.extract import collect_files, extract
        from graphify.build import build_from_json
        from graphify.cluster import cluster, score_all
        from graphify.analyze import god_nodes, surprising_connections, suggest_questions
        from graphify.report import generate
        from graphify.export import to_json

        project_root = Path.cwd()
        os.chdir(str(project_root))

        # Step 1: Detect
        result = detect(project_root)
        Path("graphify-out/.graphify_detect.json").write_text(
            json.dumps(result, ensure_ascii=False), encoding="utf-8")
        Path("graphify-out/.graphify_root").write_text(
            str(project_root.resolve()), encoding="utf-8")
        print(f"Corpus: {result['total_files']} files, ~{result['total_words']} words")
        for k, v in result.get("files", {}).items():
            if v: print(f"  {k}: {len(v)} files")

        # Step 2: AST only — max_workers=1 avoids Windows multiprocessing spawn crash
        code_files = sum(
            (collect_files(Path(f)) if Path(f).is_dir() else [Path(f)]
             for f in result.get("files", {}).get("code", [])), start=[])
        if code_files:
            print(f"Extracting AST from {len(code_files)} code files...")
            ast_result = extract(code_files, cache_root=project_root, max_workers=1)
            Path("graphify-out/.graphify_ast.json").write_text(
                json.dumps(ast_result, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"AST: {len(ast_result['nodes'])} nodes, {len(ast_result['edges'])} edges")
        else:
            Path("graphify-out/.graphify_ast.json").write_text(
                json.dumps({"nodes": [], "edges": [], "input_tokens": 0, "output_tokens": 0}),
                ensure_ascii=False)
            print("No code files, skipping AST")

        # Step 3: Merge
        ast = json.loads(Path("graphify-out/.graphify_ast.json").read_text(encoding="utf-8"))
        merged = {"nodes": list(ast["nodes"]), "edges": list(ast["edges"]),
                  "hyperedges": [], "input_tokens": 0, "output_tokens": 0}
        Path("graphify-out/.graphify_extract.json").write_text(
            json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")

        # Step 4: Build, cluster, analyze, export
        print("Building graph...")
        G = build_from_json(merged)
        communities = cluster(G)
        cohesion = score_all(G, communities)
        gods = god_nodes(G)
        surprises = surprising_connections(G, communities)
        labels = {cid: f"Community {cid}" for cid in communities}
        questions = suggest_questions(G, communities, labels)
        report = generate(G, communities, cohesion, labels, gods, surprises, result,
                          {"input": 0, "output": 0}, str(project_root), suggested_questions=questions)
        Path("graphify-out/GRAPH_REPORT.md").write_text(report, encoding="utf-8")
        to_json(G, communities, "graphify-out/graph.json")
        Path("graphify-out/.graphify_analysis.json").write_text(
            json.dumps({"communities": {str(k): v for k, v in communities.items()},
                        "cohesion": {str(k): v for k, v in cohesion.items()},
                        "gods": gods, "surprises": surprises, "questions": questions},
                       indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities")

    main()
