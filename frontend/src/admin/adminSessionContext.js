import {createContext, useContext} from 'react';
export const AdminContext=createContext(null);
export const useAdminSession=()=>useContext(AdminContext);
export const isOrganizationRole=role=>role==='super_admin'||role==='staff';
