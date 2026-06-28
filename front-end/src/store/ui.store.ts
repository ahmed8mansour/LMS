import {create} from 'zustand'

type UI = {
    isLearnSideBarOpen:boolean ;

    toggleLearnSideBar:(prev:boolean) => void;

}


export const useUIStore = create<UI>((set) => ({
    isLearnSideBarOpen : true ,


    toggleLearnSideBar: (prev:boolean) => {
        set({ isLearnSideBarOpen : prev})
    }
    ,
}))