import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import projectService from '../services/projectService';
import { ProjectCard } from '../components/ProjectCard';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await projectService.getProjects();
        setProjects(data);
      } catch (err) {
        console.error('Failed to fetch projects', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter((p: any) => 
    p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.project_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.client && p.client.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Project Portfolio</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage and track performance across all active projects.</p>
        </div>
        <button className="bg-accent-primary hover:bg-accent-secondary text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-accent-primary/20 group">
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          NEW PROJECT
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search projects by name, number or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-sidebar border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-primary/50 transition-all"
          />
        </div>
        <button className="bg-sidebar border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 px-6 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center gap-2">
          <Filter className="w-4 h-4" />
          FILTERS
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Loading portfolio...</p>
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project: any) => (
            <div key={project.project_id} onClick={() => navigate(`/projects/${project.project_id}`)}>
              <ProjectCard
                project_name={project.project_name}
                project_number={project.project_number}
                client={project.client || 'N/A'}
                total_budget={project.total_budget}
                spent={project.spent || 0}
                percentComplete={project.percent_complete || 0}
                health={project.health || 'Green'}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-sidebar border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
          <p className="text-slate-500 text-lg">No projects found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default Projects;
