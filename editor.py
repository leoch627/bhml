import tkinter as tk
from tkinter import ttk, messagebox
import json
import paramiko
import os
import io

class BHMLEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("BHML 数据全功能编辑器")
        self.root.geometry("1000x800")

        # SSH 配置变量
        self.ssh_host = tk.StringVar(value="")
        self.ssh_port = tk.StringVar(value="22")
        self.ssh_user = tk.StringVar(value="")
        self.ssh_pass = tk.StringVar(value="")
        self.remote_path = tk.StringVar(value="/var/www/html/data/")

        self.teams_data = {"teams": {}}
        self.matches_data = {"matches": []}

        self.setup_ui()

    def setup_ui(self):
        # 顶部 SSH 连接区
        conn_frame = ttk.LabelFrame(self.root, text="服务器连接 (Scenario B - SSH/ZeroTier)")
        conn_frame.pack(fill="x", padx=10, pady=5)
        
        # 第一行：连接信息
        row1 = ttk.Frame(conn_frame)
        row1.pack(fill="x", padx=5, pady=2)
        ttk.Label(row1, text="IP:").pack(side="left")
        ttk.Entry(row1, textvariable=self.ssh_host, width=15).pack(side="left", padx=5)
        ttk.Label(row1, text="Port:").pack(side="left")
        ttk.Entry(row1, textvariable=self.ssh_port, width=5).pack(side="left", padx=5)
        ttk.Label(row1, text="User:").pack(side="left")
        ttk.Entry(row1, textvariable=self.ssh_user, width=10).pack(side="left", padx=5)
        ttk.Label(row1, text="Pass:").pack(side="left")
        ttk.Entry(row1, textvariable=self.ssh_pass, show="*", width=10).pack(side="left", padx=5)

        # 第二行：路径与操作
        row2 = ttk.Frame(conn_frame)
        row2.pack(fill="x", padx=5, pady=2)
        ttk.Label(row2, text="远程路径:").pack(side="left")
        ttk.Entry(row2, textvariable=self.remote_path, width=40).pack(side="left", padx=5)
        
        ttk.Button(row2, text="从服务器读取", command=self.load_remote).pack(side="left", padx=10)
        ttk.Button(row2, text="本地读取", command=self.load_local).pack(side="left", padx=5)

        # 中间内容区
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=10, pady=5)

        # 战队编辑页
        self.team_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.team_frame, text="战队管理")
        self.setup_team_ui()

        # 比赛编辑页
        self.match_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.match_frame, text="比赛管理")
        self.setup_match_ui()

        # 底部保存区
        btn_frame = ttk.Frame(self.root)
        btn_frame.pack(fill="x", padx=10, pady=10)
        ttk.Button(btn_frame, text="保存并同步 (本地或远程)", command=self.save_all).pack(side="right", padx=5)

    def setup_team_ui(self):
        # 左侧列表
        list_frame = ttk.Frame(self.team_frame)
        list_frame.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        
        self.team_tree = ttk.Treeview(list_frame, columns=("ID", "Name"), show="headings")
        self.team_tree.heading("ID", text="战队ID (Key)")
        self.team_tree.heading("Name", text="显示名称")
        self.team_tree.pack(fill="both", expand=True)
        
        # 右侧编辑
        edit_f = ttk.LabelFrame(self.team_frame, text="编辑战队")
        edit_f.pack(side="right", fill="y", padx=5, pady=5)
        
        self.t_id_v = tk.StringVar()
        ttk.Label(edit_f, text="战队ID (如 rdfz):").pack(anchor="w", padx=5)
        ttk.Entry(edit_f, textvariable=self.t_id_v).pack(padx=5, pady=2)
        
        self.t_name_v = tk.StringVar()
        ttk.Label(edit_f, text="战队名称:").pack(anchor="w", padx=5)
        ttk.Entry(edit_f, textvariable=self.t_name_v).pack(padx=5, pady=2)
        
        ttk.Button(edit_f, text="添加/更新战队", command=self.add_update_team).pack(fill="x", padx=5, pady=10)
        ttk.Button(edit_f, text="删除选中战队", command=self.delete_team).pack(fill="x", padx=5, pady=5)
        
        self.team_tree.bind("<<TreeviewSelect>>", self.on_team_select)

    def setup_match_ui(self):
        # 左侧列表
        list_frame = ttk.Frame(self.match_frame)
        list_frame.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        
        self.match_tree = ttk.Treeview(list_frame, columns=("ID", "Status", "A", "Score", "B"), show="headings")
        self.match_tree.heading("ID", text="比赛ID")
        self.match_tree.heading("Status", text="状态")
        self.match_tree.heading("A", text="战队A")
        self.match_tree.heading("Score", text="比分")
        self.match_tree.heading("B", text="战队B")
        self.match_tree.pack(fill="both", expand=True)

        # 右侧编辑
        edit_f = ttk.LabelFrame(self.match_frame, text="编辑比赛")
        edit_f.pack(side="right", fill="y", padx=5, pady=5)

        self.m_id_v = tk.StringVar()
        ttk.Label(edit_f, text="比赛ID:").pack(anchor="w", padx=5)
        ttk.Entry(edit_f, textvariable=self.m_id_v).pack(padx=5, pady=2)

        self.m_status_v = tk.StringVar()
        ttk.Label(edit_f, text="状态:").pack(anchor="w", padx=5)
        ttk.Combobox(edit_f, textvariable=self.m_status_v, values=["upcoming", "live", "completed", "tba"]).pack(padx=5, pady=2)

        self.m_team_a = tk.StringVar()
        ttk.Label(edit_f, text="战队A (ID):").pack(anchor="w", padx=5)
        ttk.Entry(edit_f, textvariable=self.m_team_a).pack(padx=5, pady=2)

        self.m_team_b = tk.StringVar()
        ttk.Label(edit_f, text="战队B (ID):").pack(anchor="w", padx=5)
        ttk.Entry(edit_f, textvariable=self.m_team_b).pack(padx=5, pady=2)

        self.m_score_a = tk.StringVar()
        self.m_score_b = tk.StringVar()
        ttk.Label(edit_f, text="得分 A:").pack(anchor="w", padx=5)
        ttk.Entry(edit_f, textvariable=self.m_score_a).pack(padx=5, pady=2)
        ttk.Label(edit_f, text="得分 B:").pack(anchor="w", padx=5)
        ttk.Entry(edit_f, textvariable=self.m_score_b).pack(padx=5, pady=2)

        ttk.Button(edit_f, text="添加/更新赛果", command=self.add_update_match).pack(fill="x", padx=5, pady=10)
        ttk.Button(edit_f, text="删除选中比赛", command=self.delete_match).pack(fill="x", padx=5, pady=5)
        
        self.match_tree.bind("<<TreeviewSelect>>", self.on_match_select)

    # --- 辅助方法 ---
    def get_sftp(self):
        host = self.ssh_host.get()
        port = int(self.ssh_port.get() or 22)
        user = self.ssh_user.get()
        pwd = self.ssh_pass.get()
        
        transport = paramiko.Transport((host, port))
        transport.connect(username=user, password=pwd)
        return paramiko.SFTPClient.from_transport(transport)

    def load_remote(self):
        try:
            sftp = self.get_sftp()
            base = self.remote_path.get()
            
            with sftp.open(os.path.join(base, "teams.json"), "r") as f:
                content = f.read().decode('utf-8')
                self.teams_data = json.loads(content)
            with sftp.open(os.path.join(base, "matches.json"), "r") as f:
                content = f.read().decode('utf-8')
                self.matches_data = json.loads(content)
            
            sftp.close()
            self.refresh_ui()
            messagebox.showinfo("成功", "已从服务器加载数据")
        except Exception as e:
            messagebox.showerror("错误", f"加载失败: {e}")

    def load_local(self):
        try:
            if not os.path.exists("data"):
                os.makedirs("data")
            
            t_path = "data/teams.json"
            if os.path.exists(t_path):
                with open(t_path, "r", encoding="utf-8") as f:
                    self.teams_data = json.load(f)
            
            m_path = "data/matches.json"
            if os.path.exists(m_path):
                with open(m_path, "r", encoding="utf-8") as f:
                    self.matches_data = json.load(f)
            
            self.refresh_ui()
            messagebox.showinfo("成功", "已加载本地数据")
        except Exception as e:
            messagebox.showerror("错误", f"加载失败: {e}")

    def refresh_ui(self):
        # 刷新战队列表
        for i in self.team_tree.get_children(): self.team_tree.delete(i)
        teams = self.teams_data.get("teams", {})
        for tid, info in teams.items():
            self.team_tree.insert("", "end", iid=tid, values=(tid, info.get("name", "")))

        # 刷新比赛列表
        for i in self.match_tree.get_children(): self.match_tree.delete(i)
        matches = self.matches_data.get("matches", [])
        for idx, m in enumerate(matches):
            score = f"{m.get('score',{}).get('a','tba')} : {m.get('score',{}).get('b','tba')}"
            self.match_tree.insert("", "end", iid=str(idx), values=(m.get("id",""), m.get("status",""), m.get("teams",{}).get("a",""), score, m.get("teams",{}).get("b","")))

    # --- 战队编辑逻辑 ---
    def on_team_select(self, event):
        sel = self.team_tree.selection()
        if not sel: return
        tid = sel[0]
        self.t_id_v.set(tid)
        self.t_name_v.set(self.teams_data["teams"][tid].get("name", ""))

    def add_update_team(self):
        new_id = self.t_id_v.get().strip()
        new_name = self.t_name_v.get().strip()
        if not new_id:
            messagebox.showwarning("警告", "战队ID不能为空")
            return
        
        if "teams" not in self.teams_data:
            self.teams_data["teams"] = {}
            
        # 如果ID变了（即重命名ID），需要删除旧的
        selected = self.team_tree.selection()
        if selected and selected[0] != new_id:
            if selected[0] in self.teams_data["teams"]:
                old_data = self.teams_data["teams"].pop(selected[0])
                self.teams_data["teams"][new_id] = old_data
        
        if new_id not in self.teams_data["teams"]:
            self.teams_data["teams"][new_id] = {"members": [], "logo": ""}
            
        self.teams_data["teams"][new_id]["name"] = new_name
        self.refresh_ui()

    def delete_team(self):
        sel = self.team_tree.selection()
        if not sel: return
        if messagebox.askyesno("确认", f"确定要删除战队 {sel[0]} 吗？"):
            del self.teams_data["teams"][sel[0]]
            self.refresh_ui()

    # --- 比赛编辑逻辑 ---
    def on_match_select(self, event):
        sel = self.match_tree.selection()
        if not sel: return
        idx = int(sel[0])
        m = self.matches_data["matches"][idx]
        self.m_id_v.set(m.get("id", ""))
        self.m_status_v.set(m.get("status", "upcoming"))
        self.m_team_a.set(m.get("teams", {}).get("a", ""))
        self.m_team_b.set(m.get("teams", {}).get("b", ""))
        self.m_score_a.set(str(m.get("score", {}).get("a", "tba")))
        self.m_score_b.set(str(m.get("score", {}).get("b", "tba")))

    def add_update_match(self):
        mid = self.m_id_v.get().strip()
        if not mid:
            messagebox.showwarning("警告", "比赛ID不能为空")
            return
            
        match_entry = {
            "id": mid,
            "stage": "第一阶段",
            "status": self.m_status_v.get(),
            "format": "bo1",
            "time": "2026-02-01T20:00:00+08:00", # 默认占位
            "teams": {"a": self.m_team_a.get(), "b": self.m_team_b.get()},
            "score": {"a": self.parse_score(self.m_score_a.get()), "b": self.parse_score(self.m_score_b.get())},
            "banpick": [],
            "maps": []
        }
        
        # 查找是否存在同ID比赛
        found_idx = -1
        for i, m in enumerate(self.matches_data.get("matches", [])):
            if m.get("id") == mid:
                found_idx = i
                break
        
        if found_idx >= 0:
            # 保留原有的时间、阶段、banpick等复杂信息
            old = self.matches_data["matches"][found_idx]
            match_entry["time"] = old.get("time", match_entry["time"])
            match_entry["stage"] = old.get("stage", match_entry["stage"])
            match_entry["format"] = old.get("format", match_entry["format"])
            match_entry["banpick"] = old.get("banpick", [])
            match_entry["maps"] = old.get("maps", [])
            self.matches_data["matches"][found_idx] = match_entry
        else:
            if "matches" not in self.matches_data:
                self.matches_data["matches"] = []
            self.matches_data["matches"].append(match_entry)
            
        self.refresh_ui()

    def delete_match(self):
        sel = self.match_tree.selection()
        if not sel: return
        idx = int(sel[0])
        m_id = self.matches_data["matches"][idx].get("id", "未知")
        if messagebox.askyesno("确认", f"确定要删除比赛 {m_id} 吗？"):
            self.matches_data["matches"].pop(idx)
            self.refresh_ui()

    def parse_score(self, val):
        val = val.strip().lower()
        if val == "tba" or val == "": return "tba"
        try:
            return int(val)
        except:
            return val

    # --- 保存逻辑 ---
    def save_all(self):
        try:
            t_json = json.dumps(self.teams_data, indent=2, ensure_ascii=False)
            m_json = json.dumps(self.matches_data, indent=2, ensure_ascii=False)
            
            if self.ssh_host.get():
                sftp = self.get_sftp()
                base = self.remote_path.get()
                
                with sftp.open(os.path.join(base, "teams.json"), "w") as f:
                    f.write(t_json.encode('utf-8'))
                with sftp.open(os.path.join(base, "matches.json"), "w") as f:
                    f.write(m_json.encode('utf-8'))
                
                sftp.close()
                messagebox.showinfo("成功", "数据已同步至服务器")
            else:
                if not os.path.exists("data"): os.makedirs("data")
                with open("data/teams.json", "w", encoding="utf-8") as f:
                    f.write(t_json)
                with open("data/matches.json", "w", encoding="utf-8") as f:
                    f.write(m_json)
                messagebox.showinfo("成功", "数据已保存至本地")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = BHMLEditor(root)
    root.mainloop()
