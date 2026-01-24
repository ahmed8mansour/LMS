interface ServiceItemProps {
    icon: React.ReactNode;
    heading: string;
    body: string;
}

const ServiceItem: React.FC<ServiceItemProps> = ({ icon, heading, body }) => {
    return (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 bg-darkmint/10 rounded-[16px] text-darkmint flex items-center justify-center">
                {icon}
            </div>
            <h2 className="text-darktext font-bold text-xl/7">{heading}</h2>
            <p className="text-graytext2 font-normal text-sm/6 text-center px-6">{body}</p>
        </div>
    );
};

export default ServiceItem;