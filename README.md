# TripleDB 静态网站：可检索版本

这个版本已经把网站框架与三个 JSON 的真实检索逻辑连接起来。网站不需要后端数据库、Flask、Django、Node server 或 MySQL；浏览器直接读取预先建立的 JSON 索引。

## 1. 放置六个固定文件

将你的发布副本放到以下位置，并使用完全一致的文件名：

```text
tripledb_site/
├── data/
│   ├── tdb_core_interaction_index.json
│   ├── gene_alias_search_index_by_organism.json
│   └── biogrid_source_index.json
└── downloads/
    ├── tdb_core_interaction_table.csv
    ├── gene_alias_table.csv
    └── biogrid_source_table.csv
```

内部原始数据和中间文件可以继续使用你自己的长文件名。只有复制到网站发布目录中的六个副本需要改成上述固定名称。以后更新数据时，替换同名文件即可，不需要修改 HTML 或 JavaScript。

## 2. 已连接的功能

### Search

- `TDB00001`：按 TripleDB_ID 检索；
- `1535083`：同时尝试 Source_ID / BioGRID ID 和 PubMed ID；
- `PUBMED:25615824` 或 `PMID:25615824`：通过 BioGRID publication index 反查对应 Source_ID，再关联核心 TripleDB 记录；
- `WRKY18`、`CDC14` 等：先查询核心 gene index，同时使用 organism-aware alias JSON 解析官方符号、系统名和同义词；
- organism、experimental system、interaction order 筛选；
- 分页以及当前页 JSON 导出。

### Browse

- 浏览全部核心记录；
- organism、experimental system 和 interaction order 筛选；
- 动态 organism 卡片；
- 动态 experimental-system 分类；
- 按字母浏览核心记录中出现的基因。

### Record details

搜索结果中的 TDB accession 会打开：

```text
record.html?id=TDB00001
```

该页面展示核心字段、Qualification、Source_ID、PubMed publication 和链接的 BioGRID source records，并支持导出单条记录 JSON。

### Source evidence

支持通过 BioGRID ID、PubMed ID、TDB accession 或 gene 查询 BioGRID-derived source records，并显示关联的 TDB accessions。

## 3. Mac 本地测试

推荐直接双击：

```text
START_LOCAL_SERVER.command
```

或者在 Terminal 中运行：

```bash
cd /你的路径/tripledb_site
python3 -m http.server 8000
```

浏览器访问：

```text
http://localhost:8000
```

不要只通过 `file://` 双击 `index.html` 测试检索，因为浏览器通常会阻止本地 HTML 使用 `fetch()` 读取 JSON。

## 4. 放置文件后先验证

```bash
python3 verify_release_files.py
```

验证脚本会检查：

- 六个固定文件是否存在；
- 三个 JSON 是否可解析；
- core JSON 是否包含 `records`、`indexes` 和主要索引；
- source JSON 是否包含 BioGRID ID 与 Publication Source 索引；
- alias JSON 是否是 organism-keyed object。

## 5. 推荐的快速测试

在网站中依次测试：

```text
TDB00001
1535083
PUBMED:25615824
WRKY18 + Arabidopsis thaliana (Columbia)
```

然后点击搜索结果中的 TDB accession 和 Source_ID，确认 record detail 与 source evidence 页面都可以打开。

## 6. 固定路径配置

路径集中写在：

```text
assets/js/config.js
```

正常更新数据时不需要修改该文件。

## 7. GitHub Pages

将 `tripledb_site` 文件夹内的内容放到 GitHub 仓库根目录，使 `index.html` 位于仓库根目录。然后在 Repository Settings → Pages 中选择目标 branch。`.nojekyll` 已包含在网站中。

三个 JSON 的总体积目前适合纯静态加载。以后数据规模显著增加时，可以再考虑按物种拆分或改为后端 API，但当前 5,450 条核心记录和 10,202 条 source records 不需要后端。
