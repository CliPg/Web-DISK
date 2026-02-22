"""
数据库迁移脚本：添加知识图谱支持

运行方式: uv run python backend/db/migrate.py
"""
import sqlite3
from pathlib import Path
from backend.core.config import settings


def migrate_database():
    """执行数据库迁移"""
    db_path = settings.SQLITE_DB_PATH

    if not db_path.exists():
        print(f"数据库不存在: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    try:
        # 检查是否已有 knowledge_graphs 表
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_graphs'")
        kg_table_exists = cursor.fetchone() is not None

        # 创建 knowledge_graphs 表
        if not kg_table_exists:
            print("创建 knowledge_graphs 表...")
            cursor.execute("""
                CREATE TABLE knowledge_graphs (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE,
                    description TEXT,
                    is_default BOOLEAN DEFAULT 0,
                    entity_count INTEGER DEFAULT 0,
                    relation_count INTEGER DEFAULT 0,
                    document_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("✓ knowledge_graphs 表创建成功")
        else:
            print("knowledge_graphs 表已存在")

        # 检查 documents 表是否有 graph_id 列
        cursor.execute("PRAGMA table_info(documents)")
        columns = [col[1] for col in cursor.fetchall()]
        has_graph_id = 'graph_id' in columns

        if not has_graph_id:
            print("添加 documents.graph_id 列...")
            cursor.execute("ALTER TABLE documents ADD COLUMN graph_id VARCHAR REFERENCES knowledge_graphs(id)")
            print("✓ graph_id 列添加成功")
        else:
            print("documents.graph_id 列已存在")

        # 创建默认知识图谱
        cursor.execute("SELECT id FROM knowledge_graphs WHERE is_default = 1")
        default_graph = cursor.fetchone()

        if not default_graph:
            import uuid
            default_id = str(uuid.uuid4())
            print(f"创建默认知识图谱 (ID: {default_id})...")
            cursor.execute("""
                INSERT INTO knowledge_graphs (id, name, description, is_default, entity_count, relation_count, document_count)
                VALUES (?, ?, ?, 1, 0, 0, 0)
            """, (default_id, "默认知识图谱", "系统默认的知识图谱"))
            print("✓ 默认知识图谱创建成功")

            # 将所有现有文档关联到默认知识图谱
            cursor.execute("UPDATE documents SET graph_id = ? WHERE graph_id IS NULL", (default_id,))
            print(f"✓ 现有文档已关联到默认知识图谱")
        else:
            print("默认知识图谱已存在")

        # 更新知识图谱的文档统计
        print("更新知识图谱统计信息...")
        cursor.execute("""
            UPDATE knowledge_graphs
            SET document_count = (
                SELECT COUNT(*) FROM documents WHERE documents.graph_id = knowledge_graphs.id
            )
        """)
        print("✓ 统计信息更新完成")

        conn.commit()
        print("\n数据库迁移完成！")

    except Exception as e:
        conn.rollback()
        print(f"\n迁移失败: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate_database()
